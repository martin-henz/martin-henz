---
tags: SICP-JS
---

# An Explicit-control Evaluator in Stages

*last revision: August 29, 2022*

## In a nutshell

This post describes five implementations of explicit control evaluators. To play with them, click the links:
* [Calculator language](https://share.sourceacademy.org/jvchr)
* [Adding booleans, conditionals, and sequences](https://share.sourceacademy.org/wd3sb)
* [Adding blocks, declarations, and names](https://share.sourceacademy.org/p36zw)
* [Adding functions with implicit return](https://share.sourceacademy.org/47g89)
* [Adding return statements](https://share.sourceacademy.org/lp544)

## Motivation

In
[the previous post](https://martin-henz.github.io/martin-henz/2022/04/13/mce-in-stages.html),
I described how to construct a recursive evaluator for a sublanguage
of JavaScript in a step-by-step fashion.
The result relies heavily on recursion in the host language (the language in which the
evaluator is written, which is also JavaScript), and results in
recursive processes even when the interpreted functions are all tail-recursive and thus
should give rise to iterative processes (following the
[SICP JS terminology](https://sourceacademy.org/sicpjs/1.2.1)). In this post,
I'm going to fix this: I will present an evaluator that runs in a simple loop that can
be implemented in a low-level language without recursion, and functions that give rise to
iterative processes in JavaScript also give rise to iterative processes when evaluated using
this interpreter. To avoid recursion, I make control explicit by
storing the expressions and statements that need to be evaluated as *agenda*, by
using an explicit *operand stack*, and 
by augmenting the language with *instructions* that operate on this operand stack.
The evaluator is naturally tail-recursive, because it only saves agendas and
environments if they are needed after function calls.
As in the previous post, I proceed in stages
to gently introduce the features of evaluators for increasingly powerful sublanguages of
JavaScript.

## An explicit-control evaluator for a calculator language

As in the previous post, we start with a calculator sublanguage of JavaScript. A program in such a language is a single expression statement, and the expression consists of numbers and the binary operators `+`, `-`, `*`, and `/`. A typical "program" looks like this:
``` js
1 + 2 * 3 - 4;
```
Recall that the function `parse` translates such a program into a syntax tree:
``` js
parse("1 + 2 * 3 - 4;");
```
which results in
``` js
list("binary_operator_combination",
     "-",
     list("binary_operator_combination",
          "+",
          list("literal", 1),
          list("binary_operator_combination",
	       "*",
	       list("literal", 2), list("literal", 3))),
     list("literal", 4))
```
using the [list notation](https://sourceacademy.org/sicpjs/2.2.1#p4) of SICP JS. The 
recursive evaluator described in
[the previous post](https://martin-henz.github.io/martin-henz/2022/04/13/mce-in-stages.html) 
consisted in a function `evaluate` that recursively evaluated the component expressions of
a given operator combination, and combined the results using a function `apply`.
``` js
function evaluate(expr) { 
    return is_literal(expr)
           ? literal_value(expr)
           : is_operator_comb(expr)
           ? apply(operator_comb_operator_symbol(expr),
               list_of_values( 
                 list(operator_comb_first_operand(expr),
                      operator_comb_second_operand(expr))))
           : error(expr, "Unknown expression: ");
}
```
Operand expressions were evaluated using the 
function `list_of_values` which makes use of the higher-order function `map`.
``` js
function list_of_values(exprs) {
    return map(evaluate, exprs); 
}
```
Instead of relying on recursion and `map`, an
[*explicit-control* evaluator for the calculator language](https://share.sourceacademy.org/jvchr)
(click on the link to play with the program) stores the
remaining operand expressions as a *agenda*, a list of expressions that still need to be evaluated
once the evaluation of the current expression is done. Intermediate evaluation results are stored
in a data structure called the *operand stack*. Here is an outline of the new `evaluate` function.
``` js
function evaluate(program) {
    let agenda = list(program);
    let operands = null;
    while (! is_null(agenda)) {
        const component = head(agenda);
        agenda = tail(agenda);
	...
    }
    return head(operands);
}
```
It consists of a while loop that processes the first of a list of components, called *agenda*, starting with the one-element list containing the given calculator program. The evaluation is done when there are no more components in the agenda, in which case the final result is the only remaining element on the operand stack.

When the first component is a literal, its value its pushed on the operand stack.
``` js
    while (! is_null(agenda)) {
        const component = head(agenda);
        agenda = tail(agenda);
        if (is_literal(component)) {
            operands = pair(literal_value(component), operands);
        } else // handle remaining cases
        } else {
            error(component, "Unknown expression: ");
        }
    }
    return head(operands);
} 
```
When the loop encounters a binary operator combination, it prepends to the agenda the two operand expressions and a *binary operator instruction*, which is a data structure that contains the operator symbol.
``` js
        } else if (is_operator_comb(component)) {
            agenda = 
                pair(operator_comb_first_operand(component),
                     pair(operator_comb_second_operand(component),
                          pair(make_binary_operator_instruction(
                                   operator_comb_operator_symbol(
                                       component)),
                               agenda)));
        } else ...
```
Like statements and expressions, binary operator instructions are represented by tagged data structures.
``` js
function make_binary_operator_instruction(operator) {
    return list("binary_operator_instruction", operator);
}
function is_binary_operator_instruction(x) {
    return is_tagged_list(x, "binary_operator_instruction");
}
function binary_operator_instruction_operator(x) {
    return head(tail(x));
}
```
Evaluation of a binary operator instruction pops two operands from the operand stack (where the first operand is below the second operand on the operand stack), applies the operator on them using the `apply` function (see the recursive evaluator of the calculator language in the previous post), and pushes the result back on the operand stack.
``` js
        } else if (is_binary_operator_instruction(component)) {
            operands = pair(apply(binary_operator_instruction_operator(
                                      component), 
                                  list(head(tail(operands)), 
                                       head(operands))),
                            tail(tail(operands)));
        } else ...
```
You can look at this approach of evaluating binary operator combinations as a *compilation* step performed on the fly: A binary operator combination is evaluated by "compiling" it into a binary operator instruction that is stored in the agenda, behind the operand expressions. Another way to look at it is that the given expression is translated on the fly into postfix notation.

In this post, we use `parse_and_evaluate` functions that look like the corresponding functions in the previous post, but that use the `evaluate` functions of this post. For example, `parse_and_evaluate("1 + 2 * 3 - 4;"));` computes the number 3 using an iterative process that the iterative `evaluate` function above gives rise to.

## Adding booleans, conditionals, and sequences

The [next explicit-control evaluator](https://share.sourceacademy.org/p36zw) extends the calculator language by adding the boolean values `true` and `false`, conditional expressions and sequences of statements. As noted in the previous post, the component statements of a sequence are evaluated in the order in which they appear, and the result in the case of this JavaScript sublanguage is the result of evaluating the last statement of the sequence. The result of evaluating the program
``` js
8 + 34; true ? 1 + 2 : 17;
```
is therefore 3.

The explicit-control evaluator handles a conditional by moving its predicate into the agenda, before a new *branch instruction*, which stores the consequent and alternative expressions.
``` js
      } else if (is_conditional(component)) {
          agenda =
              pair(conditional_predicate(component),
                   pair(make_branch(conditional_consequent(component),
                                    conditional_alternative(component)),
                        agenda));
      } else ...			
```
Like operator instructions, branch instructions are tagged data structures.
``` js
function make_branch(component1, component2) {
    return list("branch", component1, component2);
}
function is_branch(component) {
    return is_tagged_list(component, "branch");
}
function branch_consequent(component) {
   return list_ref(component, 1);
}
function branch_alternative(component) {
   return list_ref(component, 2);
}
```
Evaluation of a branch instruction expects the result of evaluating the predicate on the operand stack, and uses it to determining whether the consequent or the alternative expression of the branch instruction should be prepended to the agenda.
``` js
      } else if (is_branch(component)) {
          agenda = pair(is_truthy(head(operands))
                        ? branch_consequent(component)
                        : branch_alternative(component),
                        agenda);
          operands = tail(operands);
      } else ...
```
The evaluation of sequences proceeds by prepending the components of the sequence
to the agenda.
``` js
      } else if (is_sequence(component)) {
          agenda = prepend_statements(sequence_statements(component),
                                      agenda);
      } else ...
```
The function `prepend_statements` compiles the sequence into the agenda such that the statements of the sequence are separated by pop instructions (here using an imperative while loop to emphasize the iterative nature of the evaluator).
``` js
function prepend_statements(statements, agenda) {
    if (is_null(statements)) {
        return agenda;
    } else {
        let current_read_pointer = statements;
        const result = pair(head(statements), undefined);
        let current_write_pointer = result;
        while (! is_null(tail(current_read_pointer))) {
            current_read_pointer = tail(current_read_pointer);
            const pop_pair = pair(make_pop_instruction(), 
                                  pair(head(current_read_pointer),
                                       undefined));
            set_tail(current_write_pointer, pop_pair);
            current_write_pointer = tail(tail(current_write_pointer));
        }
        set_tail(current_write_pointer, agenda);
        return result;
    }
}
```
The result of evaluating every sequence component except the last one is popped from the operand stack by the pop instruction.
``` js
      } else if (is_pop_instruction(component)) {
          operands = tail(operands);
      } else ...
```
For example, the result of
``` js
parse_and_evaluate("8 + 34; true ? 1 + 2 : 17;");
```
is 3 because the result of `8 + 34` is popped from the operand stack by a pop instruction
generated by `prepare_statements`.

## Adding blocks, declarations, and names

The [next evaluator](https://share.sourceacademy.org/wdldj) adds blocks, block-scoped `const` declarations, and names. A typical example is
``` js
const y = 4; 
{
    const x = y + 7; 
    x * 2;
}
```
which evaluates to 22 because in the program, the name `y` is declared to be 4, and in the block (delimited by braces `{...}`) the name `x` is declared to refer to `y + 7`, i.e. 11.

Similar to the recursive evaluator for blocks, declarations, and names, the explicit-control evaluator for blocks, declarations, and names uses an environment that keeps track of the names that are declared in any given scope and the values that these names refer to at any given time. 
``` js
function evaluate(program) {
    let agenda = list(program);
    let operands = null;
    let environment = the_empty_environment;
    while (!is_null(agenda)) {
        const component = head(agenda);
        agenda = tail(agenda);
        ...
    }
    return head(operands);
} 
```
The evaluation of a name occurrence looks up the value associated with the symbol (string) of the name in the environment using `lookup_symbol_value` and pushes it onto the operand stack.
``` js
        } else if (is_name(component)) {
            operands = pair(lookup_symbol_value(symbol_of_name(component), 
                                                environment),
                            operands);
        } else ...
```
Similar to the recursive evaluator, the explicit-control evaluator handles blocks by scanning out the local names that are declared in the block body and binding them to their initial value `*unassigned*` in a new environment with respect to which the body is evaluated.
``` js
        } else if (is_block(component)) {
            const body = block_body(component);
            const locals = scan_out_declarations(body);
            agenda = pair(body, 
                          needs_current_environment(agenda)
                          ? pair(make_restore_environment_instruction(
                                     environment),
                                 agenda)
                          : agenda);
            environment = extend_environment(locals,
                                             list_of_unassigned(locals),
                                             environment);                              
        } else ...
```
Between the body and the agenda, a restore-environment instruction is inserted
if the agenda may need the current environment.
``` js
function make_restore_environment_instruction(env) {
    return list("restore_environment_instruction", env);
}
function is_restore_environment_instruction(instr) {
    return is_tagged_list(instr, "restore_environment_instruction");
}
function restore_environment_instruction_environment(instr) {
    return head(tail(instr));
}
```
If there is any chance that the current environment is needed, for example in a branch of a conditional, the function `needs_current_environment` must return true. 
``` js
function needs_current_environment(agenda) {
    return ! is_null(agenda) && 
           ! is_restore_environment_instruction(head(agenda));
}
```
This version of `needs_current_environment` is quite simple and conservative. Feel free to experiment with more sophisticated versions that avoid the creation of restore-environment instructions in more cases.

The evaluation of a restore-environment instruction establishes the environment before it was extended when the scope was entered.
``` js
        } else if (is_restore_environment_instruction(component)) {
            environment = restore_environment_instruction_environment(
                              component);
        } else ...
```
Constant declarations are evaluated by moving the value expression into the agenda in front of a new assign instruction.
``` js
        } else if (is_declaration(component)) {
            agenda = pair(declaration_value_expression(component),
                              pair(make_assign_instruction(
                                       declaration_symbol(component)),
                                   agenda));
        } else ...
```
and an assign instruction uses the `assign_symbol_value` function as did
the recursive evaluator.
``` js
        } else if (is_assign_instruction(component)) {
            assign_symbol_value(assign_symbol(component),
                                head(operands),
                                environment);
	} else ...
```
In JavaScript, the value of an assignment is the assigned value,
which just remains on the operand stack.

As the other instructions, assign instructions are tagged lists.
``` js
function make_assign_instruction(symbol) {
    return list("assign_instruction", symbol);
}
function is_assign_instruction(instr) {
    return is_tagged_list(instr, "assign_instruction");
}
function assign_symbol(instr) {
    return head(tail(instr));
}
```
Declarations outside of any block are handled by wrapping the
given program in an implicit block, as done in the recursive evaluator.
``` js
function parse_and_evaluate(program) {
    return evaluate(make_block(parse(program)), 
                    the_empty_environment);
}
```
With this, the example
``` js
parse_and_evaluate(`
const y = 4; 
{
    const x = y + 7; 
    x * 2;
}`);
```
yields the expected value 22.

## Adding functions (with implicit return)

The
[next evaluator](https://share.sourceacademy.org/47g89) introduces functions without the need for return statements. For example, the function `fact` in this language
``` js
function fact(n) {
    n === 1 ? 1 : n * fact(n - 1);
}
```
computes the factorial function for positive integers.

To make this happen in an explicit-control evaluator, the `evaluate` function needs to include cases for function declarations, lambda expressions, and function applications. Function declarations are translated to constant declarations as you have seen in the recursive evaluator.
``` js
        } else if (is_function_declaration(component)) {
            agenda = pair(function_decl_to_constant_decl(component), 
                              agenda);
        } else ...
```
The evaluation of lambda expressions pushes a function object on the operand stack.
The parameter list is reversed to match the arguments of a function call, which
will appear on the operand stack in reverse order.
``` js
        } else if (is_lambda_expression(component)) {
            operands = pair(make_function(reverse(lambda_parameter_symbols(
                                                      component)),
                                          lambda_body(component), 
                                          environment),
                            operands);
        } else ...
```
Operator combinations are treated as function applications, using the function
`operator_comb_to_application`.
``` js
        } else if (is_operator_combination(component)) {
            agenda = pair(operator_combination_to_application(component),
                          agenda);
        } else ...
```
The final task for this evaluator is to handle function application. To make control
explicit, 
the evaluator needs to keep track of the components of the application so that
they are evaluated in the given order. It then remembers to carry out the application
using a *call instruction*.
``` js
        } else if (is_application(component)) {
            const argument_expressions = arg_expressions(component);
            agenda = pair(function_expression(component),
                          append(argument_expressions,
                                 pair(make_call_instruction(
                                          length(argument_expressions)),
                                      agenda)));
```
The call instruction remembers the number of arguments
``` js
function make_call_instruction(arity) {
    return list("call_instruction", arity);
}
function is_call_instruction(instr) {
    return is_tagged_list(instr, "call_instruction");
}
function call_instruction_arity(instr) {
    return head(tail(instr));
}
```
so that it can pop the correct number of arguments from the operand stack to
find the callee function: the function to be applied.
``` js
        } else if (is_call_instruction(component)) {
            const arity = call_instruction_arity(component);
            const args = take(operands, arity);
            const callee_and_remaining_operands = drop(operands, arity);
            const callee = head(callee_and_remaining_operands);
            operands = tail(callee_and_remaining_operands);
            if (is_primitive_function(callee)) {
                operands = pair(apply_in_underlying_javascript(
                                    primitive_implementation(callee),
                                    args),
                                operands);
            } else {
                const callee_environment = function_environment(callee);
                const callee_body = function_body(callee);
                const callee_parameters = function_parameters(callee);
                agenda = pair(callee_body, 
                              needs_current_environment(agenda)
                              ? pair(make_restore_environment_instruction(
                                         environment),
                                     agenda)
                              : agenda);
                environment = extend_environment(callee_parameters,
                                                 args,
                                                 callee_environment);
            } 
        } else ...
```
If the callee function is primitive, the function `apply_in_underlying_javascript` carries out the application. If the function is compound, the body of the function is prepended to the agenda. Similar to the evaluation of blocks, a restore-environment instruction is inserted if the agenda may need the current environment. The new environment with respect to which the body is evaluated is the result of extending the function's environment with a binding of the parameters (taken from the function value) to the arguments (taken from the operand stack), both in reverse order.

At this point, it is useful to discuss *tail calls*, which are function calls that happen as the last action in a function invocation and that compute the return value of the function in which they appear. An implementation is *tail-recursive* if tail calls do not consume memory. In a tail-recursive implementation, an iterative algorithm can be implemented using tail-recursive functions without concerns about their memory consumption. In JavaScript, tail calls can only happen when the the operand stack is empty, which means that the operand stack won't consume memory. So the question whether the evaluator is tail-recursive boils down to the question whether tail calls add items to the agenda. 

This evaluator is quite naturally tail-recursive. Any tail call instruction on the agenda will be succeeded by the restore-environment instruction from the most-recently executed non-tail call instruction. In that case, there is no need to save the current environment in another restore-environment instruction. The evaluator treats tail-recursive functions as loops in which the function body is evaluated in an environment that extends the function's environment with a binding of the parameters to the evaluated arguments. In particular, tail-recursive functions do not consume memory in the agenda.

In order to provide bindings for predeclared names, the function `parse_and_evaluate` uses `the_global_environment` from the previous post as its initial environment.
``` js
function parse_and_evaluate(program) {
    return evaluate(make_block(parse(program)), 
                    the_global_environment);
}
```
The application of
our example factorial function to 4
``` js
parse_and_evaluate(`
function fact(n) {
    n === 1 ? 1 : n * fact(n - 1);
}
fact(4);
`);
```
gives the expected result of 24.

## Adding return statements

The [final evaluator](https://share.sourceacademy.org/lp544) handles return statements, a prominent feature in languages like C, Java, Python, and JavaScript. Return statements allow a function to return from anywhere in its body. Whatever statements in the body that would normally remain to be evaluated are ignored. For example, in JavaScript, the program
``` js
function f(x) {
    if (true) {
        const y = 2;
	return x + y;
	44;
    } else {
        55;
    }
    66;
}
f(1);
```
results in 3 because the evaluation of the body of `f` returns the result of evaluating `x + y` to the caller, ignoring the subsequent expression statements `44;` and `66;` that would otherwise remain to be evaluated in the body.

The difficulty with evaluating explicit return statements is that evaluation needs to abandon the remaining statements of the function, regardless whether any block statements surround the return statement or whether any statements follow the returns statement in a statement sequence. Before evaluating the function body, we need to prepare the agenda by marking the place where evaluation should resume after evaluating a return statement. The compound-function case of the call instruction will do that by placing a marker on the agenda, followed by a restore-environment instruction, as a first approximation like this.
``` js
                ...
                agenda = pair(callee_body,
                              pair(make_marker(),
                                   pair(make_restore_environment_instruction(
                                            environment),
                                        agenda)));
                ...
```
where `make_marker` is represented as a tagged list like the other components on the agenda.
``` js
function make_marker() {
    return list("marker");
}
function is_marker(instr) {
    return is_tagged_list(instr, "marker");
}
```
With such a preparation, return statements can be implemented by placing a reset-agenda instruction after the return expression in the agenda.
``` js
        } else if (is_return_statement(component)) {
            agenda = pair(return_expression(component),
                          pair(make_reset_agenda_instruction(),
                               agenda));
        } else ...
```
where reset-agenda instructions are tagged lists.
``` js
function make_reset_agenda_instruction() {
    return list("reset_agenda_instruction");
}
function is_reset_agenda_instruction(instr) {
    return is_tagged_list(instr, "reset_agenda_instruction");
}
```
The reset-agenda instruction resets the agenda by abandoning all components until the most-recently placed marker.
``` js
        } else if (is_reset_agenda_instruction(component)) {
            agenda = tail(pop_until_marker(agenda));
        } else ...
```
where `pop_until_marker` is declared as follows.
``` js
function pop_until_marker(agenda) {
    while (head(head(agenda)) !== "marker") {
        agenda = tail(agenda);
    }
    return agenda;
}
```
In JavaScript, the value `undefined` is returned if the evaluation of the function body does not encounter any return statements. The following modification in the evaluation of lambda expressions achieves this effect by appending a `return undefined;` to every function body.
``` js
        } else if (is_lambda_expression(component)) {
            components = agenda;
            operands = pair(make_function(reverse(lambda_parameter_symbols(
	                                              component)),
                                          make_sequence(
                                              list(lambda_body(component),
                                                   // insert 
                                                   // return undefined;
                                                   make_return_statement(
                                                       make_literal(
                                                           undefined)))),
                                        environment),
                          operands);
        } else ...
```
In contrast to the recursive evaluator, this explicit control evaluator does not need to handle any special "return values" during the evaluation of function bodies. The evaluation of sequences remains unaffected by return statements.

The only remaining issue lies in tail calls. The call instruction as shown above places a marker and a restore-environment instruction on the agenda, regardless of whether that's needed or not. For a tail call, there is no need for placing a marker: The most-recent non-tail call will have placed a marker on the agenda, already, which marks the correct place to reset the agenda to. An improved version of agenda update in the call instruction looks like this.
``` js
                ...
                agenda = pair(callee_body,
                              is_tail_call(agenda)
                              ? agenda
                              : pair(make_marker(),
                                     pair(make_restore_environment_instruction(
                                              environment),
                                          agenda)));
                ...
```
The function `is_tail_call` only needs to check whether the next instruction on the agenda is a reset-agenda instruction.
``` js
function is_tail_call(agenda) {
    return ! is_null(agenda) &&
           is_reset_agenda_instruction(head(agenda));
}
```
Recall however, that return statements are able to jump out of function bodies even if more statements would normally need to be evaluated in the rest of the body. In this evaluator, that means that even in a tail call, there might be components left over between the reset-agenda instruction that comes from the return statement and the next marker. So even if we avoid placing a new marker and restore-environment instruction on the agenda for tail calls, the tail call may result in an accumulation of components on the agenda. Fortunately, this can be easily avoided by reusing our `pop_until_marker` function in the case of tail calls in the implementation of call instructions.
``` js
                ...
                agenda = pair(callee_body,
                              is_tail_call(agenda)
                              ? pop_until_marker(agenda)
                              : pair(make_marker(),
                                     pair(make_restore_environment_instruction(
                                              environment),
                                          agenda)));
                ...
```
With this change, the evaluator is tail-recursive, like the previous evaluator. The function invocation that gave rise to a tail call does not use any memory, neither for a marker nor for a restore-environment instruction nor for any left-over agenda components that have accumulated during the function invocation. The next reset-agenda instruction (from the next return statement that doesn't have a tail call) will reset the agenda to the previous marker, which will be followed by the right restore-environment instruction.

To save unnecessary restore-environment instructions, we can use the same technique as in the previous evaluator, and check in the agenda update of the call instruction whether the environment is needed. That idea leads us to the final version of the call instruction.
``` js
                ...
                agenda = pair(callee_body,
                              is_tail_call(agenda)
                              ? pop_until_marker(agenda)
                              : pair(make_marker(),
                                     needs_current_environment(agenda)
                                     ? pair(make_restore_environment_instruction(
                                                environment),
                                            agenda)
                                     : agenda));
                ...
```
The factorial function above needs to have a `return` added, because otherwise it would always return `undefined`. The example program
``` js
parse_and_evaluate(`               
function factorial(n) {
    return n === 1
           ? 1
           : n * factorial(n - 1);
}
factorial(4);`);
```
results in the expected value 24. Since the multiplication with `n` is a
*deferred operation* (see [SICP JS Section 1.2.1](https://sourceacademy.org/sicpjs/1.2.1#p5), the recursive calls of `factorial` are not tail calls. The explicit-control evaluator has a non-constant
space consumption when evaluating applications of this `factorial` function to increasing positive integers. The space consumption comes from markers, restore-environment instructions, and other accumulating components in the agenda.

The following evaluation has constant space consumption because the recursive call of `fact_iter` is a tail call. The corresponding call instruction detects that the next instruction is a reset-agenda instruction and avoids the accumulation of components on the agenda.
``` js
parse_and_evaluate(`
function fact(n) {
    return fact_iter(n, 1, 1);
}
function fact_iter(n, i, acc) {
    if (i > n) {
        return acc;
    } else {
        return fact_iter(n, i + 1, acc * i);
    }
}
fact(5);
`);
```
If you choose to use conditional expressions rather than conditional statements,
the recursive call of `fact_iter` is still a tail call, and is handled correctly by the evaluator.
``` js
parse_and_evaluate(`
function fact(n) {
    return fact_iter(n, 1, 1);
}
function fact_iter(n, i, acc) {
    return i > n
           ? acc
           : fact_iter(n, i + 1, acc * i);
}
fact(5);
`);
```
The reason for this is that by the time
the call instruction gets evaluated, the branch instruction from the surrounding
conditional expression has been handled already. The next instruction after the
call instruction is a reset-agenda instruction as in the previous
version of the program, and thus it is handled correctly by the evaluator.

## Outlook

This evaluator makes control explicit by keeping track of an agenda. To do so,
it translates complex expressions such as function applications into sequences
of instructions. The next post will take this idea further, by *compiling* the
entire program into a sequence of instructions, thereby cleanly separating
compilation of a program from execution of the *machine code* that
results from the compilation.

## Thanks

Thanks to Julie Sussman for pointing out several inaccuracies and typos.
Thanks to Jerry Sussman for guiding me patiently towards evaluators that are
naturally tail-recursive.



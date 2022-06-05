---
tags: SICP-JS
---

# An Explicit-control Evaluator in Stages

*revised on May 15, 2022*

## In a nutshell

This post describes four implementations of explicit control evaluators. To play with them, click the links:
* [Calculator language](https://share.sourceacademy.org/5eoge)
* [Adding booleans, conditionals, and sequences](https://share.sourceacademy.org/jqlpy)
* [Adding blocks, declarations, and names](https://share.sourceacademy.org/z9hhe)
* [Adding functions with implicit return](https://share.sourceacademy.org/9waeh)
* [Adding return statements](https://share.sourceacademy.org/7mg4m)

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
storing the expressions and statements that need to be evaluated as *continuations*, by
using an explicit *operand stack*, and 
by augmenting the language with *instructions* that operate on this operand stack.
The evaluator is naturally tail-recursive, because it only saves continuations and
environments if they are needed after function calls.
As in the previous post, I proceed in stages
to gently introduce the features of evaluators for increasingly powerful sublanguages of
JavaScript.

## An explicit-control evaluator for a calculator language

As in the previous post,
we start with a calculator sublanguage of JavaScript. A program in such a language is a single expression
statement, and the expression consists of numbers and the binary operators `+`, `-`, `*`, and `/`.
A typical "program" looks like this:
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
[*explicit-control* evaluator for the calculator language](https://share.sourceacademy.org/5eoge)
(click on the link to play with the program) stores the
remaining operand expressions as a *continuation*, a list of expressions that still need to be evaluated
once the evaluation of the current expression is done. Intermediate evaluation results are stored
in a data structure called the *operand stack*. Here is an outline of the new `evaluate` function.
``` js
function evaluate(program) {
    let components = list(program);
    let operands = null;
    while (! is_null(components)) {
        const component = head(components);
        const continuation = tail(components);
	...
    }
    return head(operands);
}
```
It consists of a while loop that processes the first of a list of components,
starting with the one-element list containing the given calculator program.
The evaluation is done when there are no more components to evaluate, in which case
the final result is the only remaining element on the operand stack.

When the first
component is a literal, its value its pushed on the operand stack.
``` js
    while (! is_null(components)) {
        const component = head(components);
        const continuation = tail(components);
        if (is_literal(component)) {
            components = continuation;
            operands = pair(literal_value(component), operands);
        } else // handle remaining cases
        } else {
            error(component, "Unknown expression: ");
        }
    }
    return head(operands);
} 
```
When the loop encounters a binary operator combination, it prepends to the continuation
the two operand expressions and a *binary operator instruction*, which is a data structure that 
contains the operator symbol.
``` js
        } else if (is_operator_comb(component)) {
            components = 
                pair(operator_comb_first_operand(component),
                     pair(operator_comb_second_operand(component),
                          pair(make_binary_operator_instruction(
                                   operator_comb_operator_symbol(
                                       component)),
                               continuation)));
        } else ...
```
Like statements and expressions, binary operator instructions are represented by tagged data 
structures.
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
Evaluation of a binary operator instruction pops two operands from the operand stack, applies
the operator on them using the `apply` function (see the recursive evaluator of the calculator
language in the previous post), and pushes the result back on the operand stack.
``` js
        } else if (is_binary_operator_instruction(component)) {
            components = continuation;
            operands = pair(apply(binary_operator_instruction_operator(
                                      component), 
                                  list(head(operands), 
                                       head(tail(operands)))),
                            tail(tail(operands)));
        } else ...
```
You can look at this approach of evaluating binary operator combinations
as a *compilation* step performed on the fly: A binary operator combination is
evaluated by "compiling" it into a binary operator instruction that is stored in
the continuation, behind the operand expressions. Another way to look at it is
that the given expression is translated on the fly into postfix notation.

In this post, we use `parse_and_evaluate` functions that look like the corresponding
functions in the previous post, but that use the `evaluate` functions of this post.
For example, `parse_and_evaluate("1 + 2 * 3 - 4;"));` computes the number 3 using
an iterative process that the iterative `evaluate` function above gives rise to.

## Adding booleans, conditionals, and sequences

The [next explicit-control evaluator](https://share.sourceacademy.org/jqlpy) 
extends the calculator language by
adding the boolean values `true` and
`false`, conditional expressions and sequences of statements. As noted in the previous post, 
the component
statements of a sequence are evaluated in the order in which they appear, and the result
in the case of this JavaScript sublanguage is the result of evaluating the last statement
of the sequence. The result of evaluating the program
``` js
8 + 34; true ? 1 + 2 : 17;
```
is therefore 3.

The explicit-control evaluator handles a conditional by moving its predicate into the
continuation, before a new *branch instruction*, which stores the consequent and alternative
expressions.
``` js
      } else if (is_conditional(component)) {
          components =
              pair(conditional_predicate(component),
                   pair(make_branch(conditional_consequent(component),
                                    conditional_alternative(component)),
                        continuation));
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
Evaluation of a branch instruction expects the result of evaluating the predicate on
the operand stack, and uses it to determining whether the consequent or the alternative
expression of the branch instruction should be prepended to the continuation.
``` js
      } else if (is_branch(component)) {
          components = pair(is_truthy(head(operands))
                            ? branch_consequent(component)
                            : branch_alternative(component),
                            continuation);
          operands = tail(operands);
      } else ...
```
The evaluation of sequences proceeds by prepending the components of the sequence
to the continuation.
``` js
      } else if (is_sequence(component)) {
          components = prepend_statements(sequence_statements(component),
                                          continuation);
      } else ...
```
The function `prepend_statements` compiles the sequence into the continuation such
that the statements of the sequence are separated by pop instructions (here using an
imperative while loop to emphasize the iterative nature of the evaluator).
``` js
function prepend_statements(statements, continuation) {
    if (is_null(statements)) {
        return continuation;
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
        set_tail(current_write_pointer, continuation);
        return result;
    }
}
```
The result of evaluating every sequence component except the last one
is popped from the operand stack by the pop instruction.
``` js
      } else if (is_pop_instruction(component)) {
          components = continuation;
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

The [next evaluator](https://share.sourceacademy.org/z9hhe) adds blocks, block-scoped `const` declarations,
and names. A typical example is
``` js
const y = 4; 
{
    const x = y + 7; 
    x * 2;
}
```
which evaluates to 22 because in the program, the name `y` is declared to be 4, and in the
block (delimited by braces `{...}`) the name `x` is declared to refer to `y + 7`, i.e. 11.

Similar to the recursive evaluator for blocks, declarations, and names, 
the explicit-control evaluator for blocks, declarations, and names uses
an environment that keeps track of the names that are declared in any
given scope and the values that these names refer to at any given time. 
``` js
function evaluate(program) {
    let components = list(program);
    let operands = null;
    let environment = the_empty_environment;
    while (!is_null(components)) {
        const component = head(components);
        const continuation = tail(components);
        ...
    }
    return head(operands);
} 
```
The evaluation of
a name occurrence looks up the value associated with the symbol (string) of the name in the
environment using `lookup_symbol_value` and pushes it onto the operand stack.
``` js
        } else if (is_name(component)) {
            components = continuation;
            operands = pair(lookup_symbol_value(symbol_of_name(component), 
                                                environment),
                            operands);
        } else ...
```
Similar to the recursive evaluator, the explicit-control evaluator
handles blocks by scanning out the local names that are declared in the block body and binding
them to their initial value `*unassigned*` in a new environment with respect to which the
body is evaluated.
``` js
        } else if (is_block(component)) {
            const body = block_body(component);
            const locals = scan_out_declarations(body);
            components = pair(body, 
                              needs_current_environment(continuation)
                              ? pair(make_restore_environment_instruction(
                                         environment),
                                     continuation)
                              : continuation);
            environment = extend_environment(locals,
                                             list_of_unassigned(locals),
                                             environment);                              
        } else ...
```
Between the body and the continuation, a restore-environment instruction is inserted
if the continuation may need the current environment.
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
If there is any chance
that the current environment is needed, for example in a branch of a conditional,
the function `needs_current_environment` must return true. 
``` js
function needs_current_environment(components) {
    return ! is_null(components) && 
           ! is_restore_environment_instruction(head(components));
}
```
This version of `needs_current_environment` is
quite simple and conservative. Feel free to experiment with more sophisticated
versions that avoid the creation of restore-environment instructions in more
cases.

The evaluation of a restore-environment instruction establishes the environment
before it was extended when the scope was entered.
``` js
        } else if (is_restore_environment_instruction(component)) {
            components = continuation;
            environment = restore_environment_instruction_environment(
                              component);
        } else ...
```
Constant declarations are evaluated by moving the value expression into the continuation
in front of a new assign instruction.
``` js
        } else if (is_declaration(component)) {
            components = pair(declaration_value_expression(component),
                              pair(make_assign_instruction(
                                       declaration_symbol(component)),
                                   continuation));
        } else ...
```
and an assign instruction uses the `assign_symbol_value` function as did
the recursive evaluator.
``` js
        } else if (is_assign_instruction(component)) {
            assign_symbol_value(assign_symbol(component),
                                head(operands),
                                environment);
            components = continuation;
            operands = pair(undefined, operands);
	} else ...
```
The value `undefined` is pushed on the operand stack as the value of
the constant declaration that gave rise to the assign instruction.

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
[next evaluator](https://share.sourceacademy.org/9waeh) introduces functions without the need for for
return statements. For example, the function `fact` in this language
``` js
function fact(n) {
    n === 1 ? 1 : n * fact(n - 1);
}
```
computes the factorial function for positive integers.

To make this happen in an explicit-control evaluator, the `evaluate` function
in the this evaluator
needs to include cases for function declarations, lambda expressions, and
function applications. Function declarations are translated to constant declarations
as you have seen in the recursive evaluator.
``` js
        } else if (is_function_declaration(component)) {
            components = pair(function_decl_to_constant_decl(component), 
                              continuation);
        } else ...
```
The evaluation of lambda expressions pushes a function object on the operand stack.
The parameter list is reversed to match the arguments of a function call, which
will appear on the operand stack in reverse order.
``` js
        } else if (is_lambda_expression(component)) {
            components = continuation;
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
            components = pair(operator_combination_to_application(
                                  component),
                              continuation);
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
            components = pair(function_expression(component),
                              append(argument_expressions,
                                     pair(make_call_instruction(
                                              length(argument_expressions)),
                                          continuation)));
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
                components = continuation;
                operands = pair(apply_in_underlying_javascript(
                                    primitive_implementation(callee),
                                    args),
                                operands);
            } else {
                const callee_environment = function_environment(callee);
                const callee_body = function_body(callee);
                const callee_parameters = function_parameters(callee);
                components = pair(callee_body, 
                                  needs_current_environment(continuation)
                                  ? pair(make_restore_environment_instruction(
                                             environment),
                                         continuation)
                                  : continuation);
                environment = extend_environment(
                                        callee_parameters,
                                        args,
                                        callee_environment);
            } 
        } else ...
```
If the callee function is primitive, the function `apply_in_underlying_javascript` carries
out the application. If the function is compound, the body of the function
is prepended to the continuation. Similar to the evaluation of blocks, a restore-environment
instruction is inserted if the continuation may need the current environment.
The new environment with respect to which the body is evaluated is the result
of extending the function's environment with a binding of the parameters (taken from
the function value) to the arguments (taken from the operand stack), both in reverse order.

This evaluator is quite naturally tail-recursive. If the continuation of a call instruction
starts with
a restore-environment instruction from a previous call instruction or evaluation of
a block, there is no need to save the current environment in another restore-environment
instruction. The evaluator treats tail-recursive functions as loops in which the
function body is evaluated in an environment that extends the function's environment
with a binding of the parameters to the evaluated arguments. In particular,
tail-recursive functions do not consume memory in the continuation.

In order to provide bindings for predeclared names, the function `parse_and_evaluate`
uses `the_global_environment` from the previous post as its initial environment.
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

The [final evaluator](https://share.sourceacademy.org/7mg4m)
handles return statements, a prominent feature in languages like C, Java, Python, and
JavaScript. Return statements allow the programmer to return from a function from anywhere in its
body. Whatever statements in the body that remain to be evaluated are ignored.
For example, in JavaScript, the program
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
results in 3 because the evaluation of the body of `f` returns the result of evaluating `x + y` to the
caller, ignoring the subsequent expression statements `44;` and `66;` that would otherwise
remain to be evaluated in the body.

The difficulty with evaluating explicit return statements is that evaluation needs to abandon the
remaining statements of the function, regardless whether any block statements surround
the return statement or whether any statements follow the returns statement in a statement sequence.
The `evaluate` function cannot rely on the continuation to find the place
where evaluation should resume after evaluating a return statement.
Instead, a new variable called `runtime_stack` keeps track of the
continuation after returning from a function call and the environment
with respect to which to evaluate it.
``` js
function evaluate(program) {
    let components = list(program);
    let operands = null;
    let environment = the_global_environment;
    let runtime_stack = list(make_runtime_stack_frame(null, 
                                                      the_empty_environment));
    while (! is_null(components)) {
        const component = head(components);
        const continuation = tail(components);
        if ( is_literal(component)) {
            components = continuation;
            operands = pair(literal_value(component), operands);
        } else ... // remaining kinds of components
        } else {
            return error(component, "Unknown component: ");
        }
    }
    return head(operands);
} 
```
I will explain below why the runtime stack initially contains
a stack frame that has an empty continuation and an empty environment.

Runtime stack frames are tagged lists, as usual.
``` js
function make_runtime_stack_frame(comps, env) {
    return list("runtime_stack_frame", comps, env);
}
function runtime_stack_frame_components(sf) {
    return head(tail(sf));
}
function runtime_stack_frame_environment(sf) {
    return head(tail(tail(sf)));
}
```
The evaluation of a return statement abandons the current continuation
and instead installs the return expression as continuation, followed by 
a restore-continuation instruction.
``` js
        } else if (is_return_statement(component)) {
            components = list(return_expression(component),
                              make_restore_continuation_instruction());
        } else ...
```
The restore-continuation instruction restores the continuation and
environment using the frame at the top of the runtime stack.
``` js
        } else if (is_restore_continuation_instruction(component)) {
            const top_of_runtime_stack = head(runtime_stack);
            components = runtime_stack_frame_components(
                             top_of_runtime_stack);
            environment = runtime_stack_frame_environment(
                              top_of_runtime_stack);
            runtime_stack = tail(runtime_stack);
        } else ...
```
The call instruction installs the function body as continuation, without
including the current continuation, because it is the job of the return
statement in the callee function to reestablish the continuation. For this
purpose, the call instruction checks whether the current continuation
is needed, and if so, it pushes a new runtime stack frame on the
runtime stack. 
``` js
        } else if (is_call_instruction(component)) {
            const arity = call_instruction_arity(component);
            const args = take(operands, arity);
            const callee_and_remaining_operands = drop(operands, arity);
            const callee = head(callee_and_remaining_operands);
            operands = tail(callee_and_remaining_operands);
            if (is_primitive_function(callee)) {
                components = continuation;
                operands = pair(apply_in_underlying_javascript(
                                    primitive_implementation(callee),
                                    args),
                                operands);
            } else {
                const callee_environment = function_environment(callee);
                const callee_body = function_body(callee);
                const callee_parameters = function_parameters(callee);
                components = list(callee_body);
                if (needs_current_continuation(continuation)) {
                    runtime_stack = pair(make_runtime_stack_frame(
                                             continuation, environment),
                                         runtime_stack);
                }
                environment = extend_environment(callee_parameters,
                                                 args,
                                                 callee_environment);
            } 
        } else ...
```
The current continuation is not needed if the first instruction of
the continuation is a restore-continuation instruction.
``` js
function needs_current_continuation(components) {
    return ! is_null(components) &&
           ! is_restore_continuation_instruction(head(components));
}
```
I can now explain why there is an initial frame on the runtime stack before
the evaluation loop starts. The reason is that if the last statement of the
program is a call of a tail-recursive function, the last restore-continuation
instruction will pop a frame from the runtime stack without the initial call
having pushed any frame. Starting with an initial frame on the runtime stack takes
care of this situation.

In JavaScript, the value `undefined` is returned if the evaluation of the function body
does not encounter any return statements. The following modification in the evaluation
of lambda expressions achieves this effect by appending a `return undefined;` to every
function body.
``` js
        } else if (is_lambda_expression(component)) {
            components = continuation;
            operands = pair(make_function(reverse(lambda_parameter_symbols(component)),
                                          make_sequence(
                                              list(lambda_body(component),
                                                   // insert 
                                                   // return undefined
                                                   make_return_statement(
                                                       make_literal(
                                                           undefined)))),
                                        environment),
                          operands);
        } else ...
```
In contrast with the recursive evaluator, this explicit control evaluator
does not need to handle any special "return values" during the evaluation of function bodies.
The evaluation of sequences and function application remains unaffected by return statements.

Like the previous evaluator, this evaluator is quite naturally tail-recursive.
If the continuation of a call instruction starts with
a restore-continuation instruction from an enclosing return statement,
there is no need to save the current current continuation and environment
in a new runtime-stack frame. Instead, the next restore-continuation instruction
that actually gets executed will directly return to the previously saved
continuation and environment.

The factorial function above needs to have a `return` added, because otherwise
it would always return `undefined`. The example program
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
*deferred operation*, the explicit-control evaluator has a non-constant
space consumption when evaluating applications of this `factorial` function. The
space consumption comes from runtime stack frames that are pushed on the runtime
stack for every function call.

The following evaluation has constant space consumption because the recursive
call of `fact_iter` detects that the next instruction is a restore-continuation
instruction and avoids pushing a new frame on the runtime stack.
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
the recursive call of `fact_iter` still detects that the next instruction is
a restore-continuation instruction.
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
call instruction is a restore-continuation instruction as in the previous
version of the program.

## Outlook

This evaluator makes control explicit by keeping track of continuations. To do so,
it translates complex expressions such as function applications into sequences
of instructions. The next post will take this idea further, by *compiling* the
entire program into a sequence of instruction, thereby cleanly separating
compilation of a program from execution of the *machine code* that
results from the compilation.

## Thanks

Thanks to Julie Sussman for pointing out several inaccuracies and typos.
Thanks to Jerry Sussman for guiding me patiently towards evaluators that are
naturally tail-recursive.



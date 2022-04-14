---
tags: SICP-JS
---

# Metalinguistic Abstraction in Stages

## Motivation

The textbook
[Structure and Interpretation of Computer Programs, JavaScript Edition](https://sourceacademy.org/sicpjs)
concludes in Chapters 4 and 5 with interpreters and compilers that present executable mental models for
the evaluation of programs, at various levels of abstraction. Chapter 4 [starts with a recursive
metacircular
evaluator](https://sourceacademy.org/sicpjs/4.1.1) for the subset of JavaScript that is used throughout
the book. Teaching this metacircular
evaluator is a challenge because it is conceptually rich and because it is often the first medium-sized
program that students encounter (around 500 lines). In this blog post I share a teaching
technique that I've found to be useful. The idea is to introduce the metacircular evaluator in stages,
starting from a simple calculator language, and gradually extend the language to become a more and
more realistic programming language. This way, the main concepts are revealed step-by-step, and the
students gradually adapt to larger and larger programs.

## A recursive evaluator for a calculator language

We start with a calculator sublanguage of JavaScript. A program in such a language is a single expression
statement, and the expression consists of numbers and the binary operators `+`, `-`, `*`, and `/`.
A typical "program" looks like this:
``` js
1 + 2 * 3 - 4;
```
A `parse` function comes in handy, to translate such a program into a syntax tree:
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
          list("binary_operator_combination", "*", list("literal", 2), list("literal", 3))),
     list("literal", 4))
```
using the [list notation](https://sourceacademy.org/sicpjs/2.2.1#p4) of SICP JS. A [recursive
evaluator](https://share.sourceacademy.org/2bjj9) (click the link to play) for such syntax trees is
quite simple.
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
where the `apply` function uses the appropriate JavaScript operation to compute the result
``` js
function apply(operator, operands) {
    const first_op = head(operands);
    const second_op = head(tail(operands));
    return operator === "+"
           ? first_op + second_op
           : operator === "-"
           ? first_op - second_op 
           : operator === "*" 
           ? first_op * second_op 
           : operator === "/" 
           ? first_op / second_op
           : error(operator, "Unknown operator");
}
```
and where the function `list_of_values` just evaluates the elements of the given list of expressions.
``` js
function list_of_values(exprs) {
    return map(evaluate, exprs); 
}
```
The following syntax functions separate the concrete representation of the syntax tree from the
evaluation.
``` js
// literal

function is_literal(component) {
    return is_tagged_list(component, "literal");
}
function literal_value(component) {    
    return head(tail(component));
}
function is_tagged_list(component, the_tag) {
    return is_pair(component) && head(component) === the_tag;
}

// operator combination

function is_operator_comb(component) {	    
    return is_tagged_list(component, "binary_operator_combination");
}
function operator_comb_operator_symbol(component) {
    return list_ref(component, 1);
}
function operator_comb_first_operand(component) {
    return list_ref(component, 2);
}
function operator_comb_second_operand(component) {
    return list_ref(component, 3);
}
```
Finally, a function `parse_and_evaluate` provides a convenient interface to the evaluator.
``` js
function parse_and_evaluate(program) {
    return evaluate(parse(program));
}
```
For example `parse_and_evaluate("1 + 2 * 3 - 4;"));` returns the expected result, the number 3.

## Adding booleans, conditionals, and sequences

The [next evaluator](https://share.sourceacademy.org/1rsj3) extends the calculator language by
adding the boolean values `true` and
`false`, conditional expressions and sequences of statements. In JavaScript, the component
statements of a sequence are evaluates in the order in which they appear, and the result
in the case of this JavaScript sublanguage is the result of evaluating the last statement
of the sequence. The result of evaluating the program
``` js
8 + 34; true ? 1 + 2 : 17;
```
is 3, because the result of evaluating the first statement of the sequence `8 + 34` is ignored, and
the conditional expression evaluates `1 + 2` because its predicate is true.

The boolean values `true` and `false` are literal values like numbers, so the only additional
cases in [this evaluator](https://share.sourceacademy.org/1rsj3) (click on the link for
all necessary syntax and support functions) handle conditionals and sequences.
``` js
function evaluate(comp) { 
    return is_literal(comp)
           ? literal_value(comp)
           : is_operator_comb(comp)
           ? apply(operator_comb_operator_symbol(comp),
               list_of_values( 
                 list(operator_comb_first_operand(comp),
                      operator_comb_second_operand(comp))))
           : is_conditional(comp)
           ? eval_conditional(comp)
           : is_sequence(comp)
           ? eval_sequence(sequence_statements(comp)) 
           : error(comp, "Unknown component:");
}
```
The function `eval_conditional` checks whether the result of evaluating the predicate is
considered true (using the function `is_truthy`) and evaluates the appropriate branch.
``` js
function eval_conditional(comp) {
   return is_truthy(evaluate(conditional_predicate(comp)))
          ? evaluate(conditional_consequent(comp))
          : evaluate(conditional_alternative(comp));
}
```
The function `eval_sequence` recursively evaluates the components of the sequence.
``` js
function eval_sequence(stmts) { 
    if (is_empty_sequence(stmts)) {
        return undefined;
    } else if (is_last_statement(stmts)) {
        return evaluate(first_statement(stmts));
    } else {
        const ignore = evaluate(first_statement(stmts));
        return eval_sequence(rest_statements(stmts)); 
    } 
}
```
For example, the result of
``` js
parse_and_evaluate("8 + 34; true ? 1 + 2 : 17;");
```
is 3 because the result of `8 + 34` is ignored by `eval_sequence`, and the `eval_conditional` chooses
the consequent expression.

## Adding blocks, declarations, and names

The [next evaluator](https://share.sourceacademy.org/rhl4t) adds blocks, `const` declarations,
and names. A typical example is
``` js
const y = 4; 
{
    const x = y + 7; 
    x * 2;
}
```
which evaluates to 22 because in the program, the name `y` is declared to be 4, and in the
block (delimited by braces `{...}`) then name `x` is declared to be `y + 7`, i.e. 11.
Declarations that use JavaScript's `const` and `let` enjoy block scope. To handle declarations within
blocks and occurrences of names in their scope,
[this evaluator](https://share.sourceacademy.org/rhl4t) (click to see the new syntax
and support functions) adds the functions `eval_block` and `eval_declaration`.
``` js
function evaluate(comp, env) { 
    return is_literal(comp)
           ? literal_value(comp)
	   ...
           : is_name(comp)
           ? lookup_symbol_value(symbol_of_name(comp), env)
           : is_block(comp)
           ? eval_block(comp, env)
           : is_declaration(comp)
           ? eval_declaration(comp, env)
           : error(comp, "Unknown component:");
}
```
This version of the function `evaluate` has a new parameter `env` that keeps track of the names
that are declared
in any given scope and the values that these names refer to at any given time. The function
`eval_block` scans out the local names that are declared in the body of a given block, and evaluates
the body in an environment that extends the current environment by bindings of the local names
to their initial value `*unassigned*`.
``` js
function eval_block(component, env) {
    const body = block_body(component);
    const locals = scan_out_declarations(body);
    const unassigneds = list_of_unassigned(locals);
    return evaluate(body, extend_environment(locals,
                                             unassigneds, 
                                             env));
}

function list_of_unassigned(symbols) {
    return map(symbol => "*unassigned*", symbols);
}
```
The function `eval_declaration` just assigns in the current environment
the symbol of the declaration to the result of evaluating the expression of the declaration.
``` js
function eval_declaration(component, env) {
    assign_symbol_value(
        declaration_symbol(component), 
        evaluate(declaration_value_expression(component), env),
        env);
  return undefined;
}
```
To get declarations to work outside of any block, the function `parse_and_evaluate` wraps the
given program in an implicit block.
``` js
function parse_and_evaluate(program) {
    return evaluate(make_block(parse(program)), 
                    the_empty_environment);
}
```
Then
``` js
parse_and_evaluate(`
const y = 4; 
{
    const x = y + 7; 
    x * 2;
}`);
```
yields the expected value 3.

### Adding functions (with implicit return)

The
[next evaluator](https://share.sourceacademy.org/ui2bk) deviates a bit from JavaScript,
to handle function declarations and lambda expressions
in the simplest possible way. In this JavaScript variant, the return value of a function is the result
of evaluating the function body; there is no need or use for return statements in this language.
For example, the function `fact` in this language
``` js
function fact(n) {
    n === 1 ? 1 : n * fact(n - 1);
}
```
computes the factorial function for positive integers. To make this happen, the `evaluate` function
in the [this evaluator](https://share.sourceacademy.org/ui2bk)
needs to include cases for function declarations, function applications, and lambda expressions.
``` js
function evaluate(component, env) { 
    return is_literal(component)
           ? literal_value(component)
           : is_function_declaration(component)
           ? evaluate(function_decl_to_constant_decl(component), env)
           ...
           : is_application(component)
           ? apply(evaluate(function_expression(component), env),
                   list_of_values(arg_expressions(component), env))
           : is_operator_comb(component)
           ? evaluate(operator_comb_to_application(component),
                      env)
           : is_lambda_expression(component)
           ? make_function(lambda_parameter_symbols(component),
                           lambda_body(component), env)
           : error(component, "Unknown component:");
}
```
Operator combinations are now treated as function applications, using the function
`operator_comb_to_application`, and function declarations are treated as lambda
expressions, using the function `function_decl_to_constant_decl`. The function `apply`
for evaluation of function applications
is reminiscent of the evaluation of blocks. It creates a new environment in which the
function parameters refer to the already evaluated arguments, and then returns
the result of evaluating the body of the function with respect to the new environment.
``` js
function apply(fun, args) {
    return is_primitive_function(fun)
           ? apply_primitive_function(fun, args) 
           : is_compound_function(fun)
           ? evaluate(function_body(fun),
                      extend_environment( 
                          function_parameters(fun), 
                          args, 
                          function_environment(fun)))
           : error(fun, "Unknown function type:");
}
```
The function `apply` delegates the application of primitive functions to the function
`apply_primitive_function`. 
``` js
function apply_primitive_function(fun, arglist) {
    return apply_in_underlying_javascript(
               primitive_implementation(fun), arglist);
}
```
In order to provide bindings for predeclared names, the function `parse_and_evaluate` now
uses `the_global_environment` as its initial environment.
``` js
function parse_and_evaluate(program) {
    return evaluate(make_block(parse(program)), 
                    the_global_environment);
}
```
`the_global_environment` contains bindings of all predeclared
functions to their respective `primitive` functions. The application of
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

The [final evaluator](https://share.sourceacademy.org/fadhu)
handles return statements, which are included in languages like C, Java, Python, and
JavaScript. Returns statements allow the programmer to return from a function from anywhere in the
body of the function. Whatever statements in the body that remain to be evaluated are ignored.
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
caller, ignoring the subsequent statements `44;` and `66;` that would otherwise
remain to be evaluated in the body. To achieve this, the `evaluate` function 
``` js
function evaluate(component, env) {
    return is_literal(component)
           ? literal_value(component)
           ...
           : is_return_statement(component)
           ? eval_return_statement(component, env)
           ...
           : error(component, "unknown syntax -- evaluate");
}
```
in
[this evaluator](https://share.sourceacademy.org/fadhu)
uses the function `eval_return_statement`
``` js
function eval_return_statement(component, env) {
    return make_return_value(evaluate(return_expression(component),
                                      env));
}
```
which identifies the result of evaluating
the return expression as a "return value" using the function `make_return_value`.
``` js
function make_return_value(content) {
    return list("return_value", content);
}
function is_return_value(value) {
    return is_tagged_list(value, "return_value");
}
function return_value_content(value) {
    return head(tail(value));
}
```
The function `eval_sequence` now checks whether the result of evaluating the
currently first statement is such a return value, in which case it ignores
the subsequent statements.
``` js
function eval_sequence(stmts, env) {
    if (is_empty_sequence(stmts)) {
        return undefined;
    } else if (is_last_statement(stmts)) {
        return evaluate(first_statement(stmts), env);
    } else {
        const first_stmt_value = 
            evaluate(first_statement(stmts), env);
        if (is_return_value(first_stmt_value)) {
            return first_stmt_value;
        } else {
            return eval_sequence(rest_statements(stmts), env);
        }
    }
}
```
The function `apply` now checks whether the result of evaluating the body of the
function that is being applied is a return value, in which case it unwraps the
return value using the `return_value_content` function above.
``` js
function apply(fun, args) {
    if (is_primitive_function(fun)) {
        return apply_primitive_function(fun, args);
    } else if (is_compound_function(fun)) {
        const result = evaluate(function_body(fun),
                                extend_environment(
                                    function_parameters(fun),
                                    args,
                                    function_environment(fun)));
        return is_return_value(result)
               ? return_value_content(result)
               : undefined;
    } else {
        error(fun, "unknown function type -- apply");
    }
}
```
If the result of evaluating the body is not a return value, `apply` returns the
value `undefined`, which is JavaScript's default return value of functions.

With this mechanism in place, our example program
``` js
parse_and_evaluate(`               
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
`
);
```
results in the expected value 3.

The factorial function above needs to have a `return` added, because otherwise
it would always return `undefined`.
``` js
parse_and_evaluate(`               
function factorial(n) {
    return n === 1
           ? 1
           : n * factorial(n - 1);
}
factorial(4);`);
```
results in the expected value 24.

Note that the recursive evaluator presented in this section gives rise to a recursive
process even if the underlying implementation of JavaScript has proper tail calls
(such as the Safari browser), and even if the given program being interpreted is giving
rise to an iterative process according to the
[SICP JS terminology](https://sourceacademy.org/sicpjs/1.2.1), because both the
wrapping of return values in `eval_return_statement` and their unwrapping in
`apply` are deferred operations. In a future blog post, I'll show an evaluator that
fixes this.

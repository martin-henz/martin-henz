---
tags: SICP-JS
---

# Call-with-current-continuation in an Explicit Control Evaluator for JavaScript

## Motivation

In the post
[An Explicit-control Evaluator in Stages](https://martin-henz.github.io/martin-henz/2022/04/17/ece-in-stages.html),
control is made explicit by a continuation data structure. The continuation explicitly
keeps track of the components that need to be evaluated after the current component
is dealt with. The evaluator compiles complex components such as conditionals and
applications on-the-fly into sequences of smaller components in the continuation.
Components can push and pop from an operand stack, and a runtime stack allows return
statments to pass control back to caller of the currently executing function.

In this post, I show how this explicit-control evaluator can be modified to handle
call-with-current-continuation, a powerful construct available in Scheme. The
[resulting call-cc-enabled evaluator](https://share.sourceacademy.org/kqo1j) includes
the implementation and examples given below.


## What is call-with-current-continuation?

The idea is to call a function `f` in such a way that the current continuation
at the time of calling `f` is available to the programmer as a unary function.
Calling that continuation with an argument `x` will return control back to the
place where `f` was called, with `x` as return value. More concretely, our
evaluator will provide a function `callcc` which can be applied to a unary function `f`.
When declaring the function `f`, the programmer can refer to the current continuation
at the time of calling `callcc` on `f`  using the parameter of `f`, for example the name
`continuation`. The application 
`callcc(f)` is treated as an application of `f(continuation)`.
If at any time, this `continuation`
gets applied to an argument `x`, control immediately
goes back to the place where `callcc` was
called. The value `x` is then treated as the return value of the call of `callcc`.

## Example

Consider the following program in a version of JavaScript that is extended by
`callcc`.
``` js
function f(ret) {
    ret(2);
    return 3;
}
display(f(x => x)); // displays 3
display(callcc(f)); // displays 2
```
When `f` is applied normally to a given function `x => x` as `ret`, that function gets
gets applied to 2. Then
the evaluation of the body of `f` continues, and `f` returns the value 3. When `f`
is applied using `callcc`, the current continuation of the call site of `callcc` is
available as `ret` during the evaluation of the body of `f`. The effect of calling `ret`
with argument 2 is that control immediately returns to the place where `callcc` was
called, with 2 as the return value of the application of `callcc`. The
statement `return 3;` is not executed in this case. The value 2 is displayed.

## Implementation Strategy

Implementation of `callcc` in the explicit-control evaluator is not hard, but a bit
tricky. My strategy is to treat both `callcc` and the continuations as *primitive*
functions that have direct access to the operand stack, runtime stack, and continuation.
To make this work, I need to slightly modify the way primitive functions are
applied, which means I need to come up with a modified *calling convention* for primitive
functions. With that in place, the primitive function `callcc` can be added to
the environment that is used for evaluating a given program.

## Tweaking the calling convention for primitive functions

Recall that the explicit-control evaluator compiles a function application into
a sequence of components in the continuation: the function expression, followed
by the argument expressions, followed by a call instruction that remembers the number
of arguments used in the application. The following fragment of the explicit-control
evaluator handles the case where the function being applied is a primitive function.
``` js
        // call instruction clause in explicit control evaluator
        } else if (is_call_instruction(component)) {
            const arity = call_instruction_arity(component);
            const args = take(operands, arity);
            const callee_and_remaining_operands = drop(operands, arity);
            const callee = head(callee_and_remaining_operands);
            const remaining_operands = tail(callee_and_remaining_operands);
            if (is_primitive_function(callee)) {
                components = continuation;
                operands = pair(apply_in_underlying_javascript(
                                    primitive_implementation(callee),
                                    args),
                                remaining_operands);
            } else {
                ...
            }
	} else ...
```
In this calling convention, the primitive implementation does not get a chance
to change the operands, because any changes to `operands` done in the primitive
implementation is undone by the assignment to `operands` which of course
gets executed after that call of `apply_in_underlying_javascript`. In our
new evaluator, I sightly change the calling convention:
``` js
        // new call instruction clause in explicit control evaluator
        } else if (is_call_instruction(component)) {
            const arity = call_instruction_arity(component);
            const args = take(operands, arity);
            const callee_and_remaining_operands = drop(operands, arity);
            const callee = head(callee_and_remaining_operands);
            const remaining_operands = tail(callee_and_remaining_operands);
            if (is_primitive_function(callee)) {
                operands = pair(undefined, // dummy
                                drop(operands, arity + 1));
                components = continuation;
                const return_value =
                    apply_in_underlying_javascript(
                                    primitive_implementation(callee),
                                    args);
                set_head(operands, return_value); // replace dummy
            } else {
                ...
            }
        } else ...
```
The value of `operands` at the time of calling the primitive implementation
has a dummy value `undefined` in place of the return value.
The application of `set_head` will set the head of the
pair to which the name `operands` refers after 
after execution of the primitive implementation.
Therefore, the primitive implementation can make
changes to `operands`, which will survive after execution of the call
instruction. Regardless what changes the primitive implementation is
making on `operands`, the return value is guaranteed to become its
first value.

Note that this modified calling convention does not make a difference
for any existing primitive functions, because they do not modify `operands`.

## Implementing `callcc`

With this tweak in place, I implement `callcc` as
a primitive function, which is made available to the evaluator
in the initial environment that the evaluator starts with.
``` js
function evaluate(program) {
    let callcc = list("primitive",
                      f => {
		          ...
                      });
    // add primitive function callcc to initial environment
    let environment = extend_environment(list("callcc"),
                                         list(callcc),
                                         the_global_environment);
    let components = list(program);
    let operands = null;
    let runtime_stack = null;
    while (! is_null(components)) {
        ...
    }
    return head(operands);
}
```
By placing the definition of the `callcc` primitive inside the
function `evaluate`, the implementation can refer to and
manipulate the state of the evaluator. In particular, it can
declare `the_continuation` as a primitive function (explained
later). 
``` js
function evaluate(program) {
    let callcc = list("primitive",
                      f => {
                          ...
                          const the_continuation = 
                              list("primitive",
                                   x => {
                                       ...
                                   });
                          // place dummy and f on operand stack;
                          // current call instruction will replace dummy
                          // with return value the_continuation
                          operands = append(list(undefined, f),
                                            // drop previous dummy
                                            tail(operands));
                          // put call instruction back into components
                          // which will find the_continuation on top of
                          // operand stack and f below it, so f will be
                          // called with the_continuation as argument
                          components = pair(make_call_instruction(1),
                                            components);
                          return the_continuation;
                      });
    ...
}
```
This implementation of the `callcc` primitive pushes a new call instruction
on the continuation, in order to call the function `f` with the current
continuation. To make sure `f` is called, it will appear in second position
on the operand stack, after a dummy value `undefined`, which will be
replaced by the return value of the primitive function, according to the
new calling convention. The previous dummy value, which was placed by
the call instruction on top of operands, is dropped. 

The continuation itself is also implemented by a primitive function, and
therefore also has access to the machine state. Here is its implementation.
``` js
function evaluate(program) {
    let callcc = list("primitive",
                      f => {
                          // take snapshot of evaluator state
                          const the_components = components;
                          const the_operands = operands;
                          const the_environment = environment;
                          const the_runtime_stack = runtime_stack;
                          const the_continuation = 
                              list("primitive",
                                   x => {
                                       // reinstate evaluator state 
                                       components = the_components;
                                       environment = the_environment;
                                       runtime_stack = the_runtime_stack;
                                       operands = the_operands;
                                       // call instruction of continuation
                                       // will replace dummy value
                                       // on top of the_operands by x
                                       return x;
                                   });
                          ...
                          return the_continuation;
                      });
    ...
}
```
The primitive function `callcc` avails to the continuation
the state of the evaluator at the time `callcc` was called. 
When the continuation is called, it restores this state.
The calling convention places a dummy value `undefined` for
the return value of `callcc` on top of `operands`.
The return
value of the continuation is the argument of the continuation, which
will replace the dummy value.

## The nuclear bomb in your garage

[This wiki](https://wiki.c2.com/?CallWithCurrentContinuation) explains the
pros and cons of call-with-current-continuation,
and I recommend that you take a close look if you would like to include
this feature in your programming language. I'm taking the liberty to
slightly modify the "nuclear bomb" example from the wiki,
which shall conclude this blog post.
``` js
parse_and_evaluate(`
function for_each(p, lst) {
    if (is_null(lst)) {
        return "done";
    } else {
        p(head(lst));
        for_each(p, tail(lst));
    }
}
display(callcc(exit => {
                   for_each(x => x === "nuclear" 
                                 ? exit(x + " alarm") 
                                 : display(x),
                            list("this", "is", "a", 
                                 "nuclear", "bomb", 
                                 "in", "your", "garage")
                           );
                   return "don't worry";
               }));
`);
```
Here, the function to which `callcc` is applied passes a function to
`for_each` which calls the continuation `exit` if the value
`"nuclear"` is encountered. When that happens, control immediately returns
to the place where `callcc` was called, with the argument of `exit`, here
the string `"nuclear alarm"`, as
return value. Therefore, the program displays the following:
``` js
"this"
"is"
"a"
"nuclear alarm"
```
If you replace the line `"nuclear", "bomb"` with `"neat", "bicycle"`,
the program will display:
``` js
"this"
"is"
"a"
"neat"
"bicycle"
"in"
"your"
"garage"
"don't worry"
```

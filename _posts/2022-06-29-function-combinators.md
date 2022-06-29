---
tags: SDF
---

# Function Combinators

Section 2.1 of the book
[Software Design for Flexibility](https://mitpress.mit.edu/books/software-design-flexibility)
(SDF)
introduces function combinators that allow a programmer 
to describe basic functional components and *combine*
them in order build a more complex system. The presented combinators compose
functions in various ways,
rearrange their arguments and curry them, and thus they let the
programmer mix-and-match the basic functional components. The SDF authors compare this
approach to biological systems that adapt to their environment by configuring
their basic components (such as cells) in response to environmental changes.

In this post, I translate most examples from SDF Section 2.1 into JavaScript.
The translation demonstrates the use of JavaScript's rest and spread operators for
defining a library of function combinators. Since these operators use arrays
instead of Scheme's lists, you get to see some JavaScript array processing,
for example various ways to use the `splice` method for arrays.
To keep things simple, I don't cover
the arity manipulation mechanisms of SDF Section 2.1. I skip the examples of
the section *Multiple values* because JavaScript does not have a
multiple-value return mechanism.

As usual, you can click on the links to play with the programs.

## Composition of functions

The first combinator
composes two functions. The composition
yields a function `c` that first applies a given function `g` to `c`'s
arguments, and then applies a given function `f` to the result,
as shown in the following diagram (Figure 2.1 of SDF).

<img src="https://i.imgur.com/TDdrdJO.jpg" width="500">

The
[JavaScript implementation of `compose`](https://share.sourceacademy.org/6g068)
uses JavaScript's *rest*
syntax to gather the arguments of the composition into an array
`args`, and the *spread* syntax to pass each component of the
`args` array as a separate argument to `g`.
``` js
function compose(f, g) {
    return (...args) => f(g(...args));
}
```
The following example demonstrates the use of `compose`.
``` js
compose(x => ["foo", x],
        (x, y, z) => ["bar", x, y, z])("a", "b", "c");
// result: ["foo", ["bar", "a", "b", "c"]]
```
Unary functions (functions that take only one argument) can
be repeatedly applied using the following function `iterate`.
``` js
function iterate(n) {
    return f =>
           n === 0
           ? identity 
           : compose(f, iterate(n - 1)(f));
}
```
The
[function `iterate`](https://share.sourceacademy.org/qd82p)
takes a number `n` as argument and
returns a function that takes a function `f` as argument.
When applied to a unary function as `f`, the result is
a function that applies `f` as often to its argument
as indicated by the number `n`. If `n` is 0, the
result is the identity function (which applies `f`
zero times).
``` js
function identity(x) {
    return x;
}
```
Here is the example of SDF.
``` js
function square(x) {
    return x * x;
}
iterate(3)(square)(5);
// result: 390625
```

## Parallel and spread combiners

The next combinator applies two functions `f` and
`g` separately to the given arguments, and then combines
the results using another function `h`, as shown in
the following diagram (Figure 2.2 of SDF).

<img src="https://i.imgur.com/Y3j5RB5.jpg" width="500">

The
[implementation](https://share.sourceacademy.org/urgqi)
is straightforward.
``` js
function parallel_combine(h, f, g) {
    return (...args) =>
             h(f(...args), g(...args));
}
```
The following example is also from SDF.
``` js
parallel_combine((x, y) => [x, y],
                 (x, y, z) => ["foo", x, y, z],
                 (u, v, w) => ["bar", u, v, w])
("a", "b", "c");
// result: [["foo", "a", "b", "c"], ["bar", "a", "b", "c"]]
```
The variant `spread_combine` distributes the
given arguments to `f` and `g`, as depicted in the following
diagram (Figure 2.3 of SDF).

<img src="https://i.imgur.com/vT5Pk0e.jpg" width="500">

The
[implementation](https://share.sourceacademy.org/aluc1)
uses the `length` attribute of functions
access their arity.
``` js
function spread_combine(h, f, g) {
    const f_arity = f.length;
    return (...args) => 
             h(f(...array_take(args, f_arity)),
               g(...array_drop(args, f_arity)));
}
```
The following example is from SDF.
``` js
spread_combine((x, y) => [x, y],
               (x, y) => ["foo", x, y],
               (u, v, w) => ["bar", u, v, w])
("a", "b", "c", "d", "e");
// result: [["foo", "a", "b"], ["bar", "c", "d", "e"]]
```
The function `array_take` returns an array that contains
the first `n` components of the given array, and the
function `array_drop` returns an array in which the
first `n` components of the given array are missing.
``` js
function array_take(a, n) {
    const a_copy = [...a];
    a_copy.splice(n, a.length - n);
    return a_copy;
}
array_take([1,2,3,4], 2);
// result: [1, 2]

function array_drop(a, n) {
    const a_copy = [...a];
    a_copy.splice(0, n);
    return a_copy;
}
array_drop([1,2,3,4], 1);
// result: [2, 3, 4]
```
Note that both functions take care not to change
the original array `a`, by applying the destructive
JavaScript array method `splice` to a copy of the given
array. This non-destructive behavior
is important for `spread_combine` to work as intended.

## Discarding and currying an argument

The next combinator returns a function that applies
a given function `f` to all given arguments except the
argument at a given position, as depicted in the following
diagram (Figure 2.5 of SDF).

<img src="https://i.imgur.com/8fIKAaZ.jpg" width="500">

The
[implementation](https://share.sourceacademy.org/g2h4u)
uses a non-destructive
`array_remove` function.
``` js
function discard_argument(i) {
    return f => (...args) => f(...array_remove(args, i));
}
```
The following example is from SDF.
``` js
discard_argument
(2)
((x, y, z) => ["foo", x, y, z])
("a", "b", "c", "d");
// result: ["foo", "a", "b", "d"]
```
The `array_remove` function is another example for
the versatile `splice` method supported by JavaScript arrays.
``` js
function array_remove(a, n) {
    const a_copy = [...a];
    a_copy.splice(n, 1);
    return a_copy;
}
array_remove([1,2,3,4], 1);
// result: [1, 3, 4]
```
The following version of the technique of *currying*
supplies given all arguments except one to the given function
`f`. The missing argument is then passed separately to
the result function, as depicted in the following diagram
(Figure 2.6 of SDF).

<img src="https://i.imgur.com/6pka4Rk.jpg" width="500">

The
[implementation](https://share.sourceacademy.org/95qiq)
uses a non-destructive `array_insert`
method.
``` js
function curry_argument(i) {
    return (...args) => 
             f =>
               x => 
                 f(...array_insert(args, i, x));
}
```
As usual, the following example is taken from SDF:
``` js
curry_argument
(2)
("a", "b", "c")
((x, y, z, w) => ["foo", x, y, z, w])
("d");
// result: ["foo", "a", "b", "d", "c"]
```
The `array_insert` function provides yet another
example for the `splice` method.
``` js
function array_insert(a, index, value) {
    const a_copy = [...a];
    a_copy.splice(index, 0, value);
    return a_copy;
}
array_insert([1,2,3,4], 2, 44);
// result: [1, 2, 44, 3, 4]
```
The final combinator of this post allows the programmer to
rearrange the arguments to be passed to a given
function, following a specified permutation, as
depicted in the following diagram (Figure 2.7 in SDF).

<img src="https://i.imgur.com/L908LWL.jpg" width="500">

The
[implementation](https://share.sourceacademy.org/p8ucq)
uses a `make_permutation` function
the returns the actual `permute` function, which
performs the argument permutation according to the
given specification.
``` js
function permute_arguments(...permspec) {
    const permute = make_permutation(permspec);
    return f => 
             (...args) => f(...permute(args));
}
```
As usual, the following example is taken from SDF:
``` js
permute_arguments
(1, 2, 0, 3)
((x, y, z, w) => ["foo", x, y, z, w])
("a", "b", "c", "d");
// result: ["foo", "b", "c", "a", "d"]
```
The `make_permutation` function is straightforward.
``` js
function make_permutation(permspec) {
    return a => {
        const result = [];
        const a_len = array_length(permspec);
        for (let i = 0; i < a_len; i = i + 1) {
            result[i] = a[permspec[i]];
        }
        return result;
    };
}
make_permutation
([1,2,0,3])
(["a", "b", "c", "d"]);
// result: ["b", "c", "a", "d"]
```










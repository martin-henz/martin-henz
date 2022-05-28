---
tags: SICM SDF
---

# Scmutils Generic Arithmetic

Scmutils is an integrated library of Scheme procedures intended
to support teaching and research in mathematical physics and electrical
engineering. Arithmetic operations in Scmutils are generic over a variety
of mathematical datatypes. In this blog post, I explore the implementation
of generic arithmetics in JavaScript. 

## Motivation

We often want to apply operations such as "addition" and "multiplication"
generically to data without having to specify the type of the data. For
example, we would like to define a function `square` as
```js
function square(x) {
    return mul(x, x);
}
```
such that it can be applied to a `bigint`, and then multiplies the `bigint`
with itself using JavaScript's multiplication of `bigint`, or a square
matrix using matrix multiplication. For this to work, the function `mul`
need to be *generic*, which means it needs to check what
kinds of arguments it receives and dispatch to an appropriate implementation.

Such a mechanism is generally called *multiple dispatch* or *multimethods*,
and there are various JavaScript libraries for this such as
[@arrows/multimethod](https://www.npmjs.com/package/@arrows/multimethod).

## Generic operators in Scmutils

In Scmutils, generic functions are called *generic operators* and their
implementations are called *operations*. The function `make-generic-operator`
defined in `kernel/ghelper-pro.scm` 
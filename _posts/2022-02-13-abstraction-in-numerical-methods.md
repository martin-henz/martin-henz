---
tags: MIT-AI-Memo
---

# Abstraction in Numerical Methods

This is a JavaScript adaptation of the Scheme programs in the MIT AI Memo 997:
> [Abstraction in Numerical Methods](https://dspace.mit.edu/handle/1721.1/6060)

by Matthew Halfant and Gerald Jay Sussman. Click [here for the full JavaScipt](https://share.sourceacademy.org/qwp1q) program,
but make sure you read the paper along with the JavaScript functions.

## First example: Archimedean computation of π

Starting with the length s of any secant of 
the unit circle (for example, a secant of a hexagon)
we can compute the length of the secant of 
a "refine"ment: the length of the secant whose angle
is half the orginal (in the example, the secant of
dodecagon).
```javascript
function refine_by_doubling(s) { // s is a side
    return s / math_sqrt(2 + math_sqrt(4 - s * s));
}
```
The function `stream_of_iterates` takes a unary function `next` and a `value`
as arguments and returns the stream that results from
iterated applications of `next` to `value`
```js
function stream_of_iterates(next, value) {
    return pair(value,
                () => stream_of_iterates(next, next(value)));
}
```
Example: compute stream of natural numbers
```js
const integers = stream_of_iterates(x => x + 1, 0);
eval_stream(integers, 10);
```
For our estimation of π, we start with a square (polygon with 4 sides) and
build the stream of side_lengths 4, 8, 16, ...
```js
const side_lengths = 
    stream_of_iterates(refine_by_doubling, math_sqrt(2));
eval_stream(side_lengths, 10);
```
...and the corresponding stream of numbers of sides:
```js
const side_numbers = stream_of_iterates(n => 2 * n, 4);
eval_stream(side_numbers, 10);
```
```js
function semi_perimeter(length_of_side, number_of_sides) {
    return number_of_sides / 2 * length_of_side;
}
```
Example: semi-perimeter of square
```js
semi_perimeter(math_sqrt(2), 4); // 
```
The function `map_streams` maps two streams to a new stream, using a binary function `f`.
```js
function map_streams(f, s1, s2) {
    return pair(f(head(s1), head(s2)), 
                () => map_streams(f,
                                  stream_tail(s1),
                                  stream_tail(s2)));
}
```
Now we are ready to construct our stream of π approximations.
```js
const archimedean_π_sequence =
    map_streams(semi_perimeter, side_lengths, side_numbers);
```
Look at the approximations of π:    
```js
eval_stream(archimedean_π_sequence, 26);
```
Can we converge faster?

## The Richardson toolbox

A zeno-sequence is a sequence of values of a function `R`
on the numbers 1, 1/2, 1/4,...
```js
function make_zeno_sequence(R, h) {
    return pair(R(h), () => make_zeno_sequence(R, h / 2));
}
```
For example if `R` is the identity function, we just get 1, 1/2, 1/4,...
```js
const two_power_fractions = make_zeno_sequence(x => x, 1);
// eval_stream(two_power_fractions, 10);
```
We can accelerate the zeno sequence with an explictly given dominant order term.
```js
function accelerate_zeno_sequence(seq, p) {
    const two_to_the_p = math_pow(2, p);
    return map_streams((Rh, Rh_over_two) =>
                         (two_to_the_p * Rh_over_two - Rh) /
                         (two_to_the_p - 1),
                       seq,
                       stream_tail(seq));
}
```
We compute the sequence of accelerated sequences from
the original sequence `seq`, the characterizing order `p` and increment `q`.
```js
function make_zeno_tableau(seq, p, q) {
    function sequences(seq, order) {
        return pair(seq,
                    () => sequences(accelerate_zeno_sequence(seq, order),
                                    order + q));
    }
    return sequences(seq, p);
}
```
Richardson's method takes the first terms of each 
accelerated sequence in the tableau.
```js
function richardson_sequence(seq, p, q) {
    return stream_map(head, make_zeno_tableau(seq, p, q));
}
```
We accelerate the approximation of π with with Richardson's method.
```js
eval_stream(richardson_sequence(archimedean_π_sequence, 2, 2), 7);
```

## Completing the Richardson toolbox

We introduce a fancy distance criterion, to take care of very small values.
```js
function is_close_enuf(h1, h2, tolerance) {
    return math_abs(h1 - h2)
           <=
           0.5 * tolerance * (math_abs(h1) + math_abs(h2) + 2);
}
```
Here is a limit detector that uses fancy distance criterion.
```js
function stream_limit(s, tolerance) {
    function loop(s) {
        const h1 = head(s);
        const t = stream_tail(s);
        const h2 = head(t);
        return is_close_enuf(h1, h2, tolerance)
               ? h2
               : loop(t);
    }
    return loop(s);
}
```
We automate the limit calculation of Richardson's method
using this limit detector.
```js
function richardson_limit(f, start_h, ord, inc, tolerance) {
    return stream_limit(
               richardson_sequence(make_zeno_sequence(f, start_h),
                                   ord,
                                   inc),
               tolerance);
}
```

## Numerical computation of derivatives

As starting point serves a "pedestrian" derivative computation.
```js
function make_derivative_function(f) {
    return x => {
               const h = 0.00001;
               return (f(x + h) - f(x - h)) / (2 * h);
           };
}
```
Example: compute *Df(1)*, where *f(x) = x * x*
```js
make_derivative_function(x => x * x)(1);
```
Here is the stream version of the same approach.
```js
function diff_quot_stream(f, x, h) {
    return pair((f(x + h) - f(x - h)) / (2 * h),
                () => diff_quot_stream(f, x, h / 2));
}
```
Observe what happens when we compute the first 55 values. 
The values first appear to converge to the correct value 0.5, but then diverge
and finally settle on 0. Consult the memo for an explanation.
```js
eval_stream(diff_quot_stream(math_sqrt, 1, 0.1), 55);
```
To address the issue, we provide a modified version of `stream_limit`: taking an optional parameter
the specifies the maximal number of stream terms to examine...
```js
function stream_limit_opt(s, tolerance, ...opts) {
    const M = array_length(opts) === 0 ? "nomax" : opts[0];
    function loop(s, count) {
        const h1 = head(s);
        const t = stream_tail(s);
        const h2 = head(t);
        return is_close_enuf(h1, h2, tolerance)
               ? h2
               : is_number(M) && count >= M
               ? h2
               : loop(t, count + 1);
    }
    return loop(s, 2);
}
```
...and the corresponding modfied version of `richardson_limit`.
```js
function richardson_limit_opt(f, start_h, ord, inc, tolerance, ...opts) {
    return stream_limit_opt(
               richardson_sequence(make_zeno_sequence(f, start_h),
                                   ord,
                                   inc),
               tolerance,
               array_length(opts) === 0 ? "nomax" : opts[0]);
}
```
The value `machine_epsilon` is an upper bound of the expected rounding error. 
JavaScript used double-precision floating point numbers, and thus:
```js
const machine_epsilon = math_pow(2, -53);
```
The function `rederiv` applies Richardson's method to our pedestrian derivative function.
```js
function rderiv(f, tolerance) {
    return x => {
               const h = 0.1 * math_abs(x);
               const delta = f(x + h) - f(x - h);
               const roundoff = machine_epsilon *
                                (1 + math_floor(math_abs(f(x) / delta)));
               const n = math_floor(math_log(tolerance / roundoff)
                                    /
                                    math_log(2));
               return richardson_limit_opt(dx =>
                                             (f(x + dx) - f(x - dx)) / (2 * dx),
                                           h,
                                           2,
                                           2,
                                           tolerance,
                                           n + 1);
    };
}
```
Example: Compute the derivative of the square root function at value 1
```js
rderiv(math_sqrt, 1e-13)(1);
```

## Numerical integration by Romberg's method

Here is a pedestrian numerical integration using the trapezoidal rule.
```js
function trapezoid(f, a, b) {
    return n => {
               const h = (b - a) / n;
               function loop(i, sum) {
                   const x = a + i * h;
                   return i < n 
                          ? loop(i + 1, sum + f(x))
                          : sum * h;
               }
               return loop(1, (f(a) + f(b)) / 2);
           };
}
```
Let us take another jab at estimating π. The integral of *f* from 0 to 1 is π, where *f* is:
```js
function f(x) {
    return 4 / (1 + x * x);
}
const π_estimator = trapezoid(f, 0, 1);
```
Examples: Use 10 and 10000 intervals
```js
π_estimator(10);
π_estimator(10000);
```
We turn a given estimator into a sequence...
```js
function π_estimator_sequence(n) {
    return pair(π_estimator(n),
                () => π_estimator_sequence(2 * n));
}
```
...and accelerate its convergence using Richardson's method. For example,
here is how we accelerate the π estimator.
```js
eval_stream(richardson_sequence(π_estimator_sequence(10), 2, 2), 11);
```
Romberg's method avoids unnecessary recomputation of the function. We start with
a utility function for computing the sum of *f(i)* where *i* goes 
from *a* to *b* in steps of 1.
```js
function sigma(f, a, b) {
    function loop(sum, x) {
        return x > b 
               ? sum
               : loop(sum + f(x), x + 1);
    }
    return loop(0, a);
}
```
See memo for the formula *S_2n* (`next_S`):
```js
function trapezoid_sums(f, a, b) {
    function next_S(S, n) {
        const h = (b - a) / (2 * n);
        const fx = i => f(a + (2 * i - 1) * h);
        return S / 2 + h * sigma(fx, 1, n);
    } 
    function S_and_n_stream(S, n) {
        return pair(list(S, n),
                    () => S_and_n_stream(next_S(S, n), n * 2));
    }
    const h = b - a;
    const S = (h / 2) * (f(a) + f(b));
    return stream_map(head, S_and_n_stream(S, 1));
}
```
Romberg's method then boils down to applying `richardson_sequence` to the stream that results from `trapezoid_sums`.
```js
function romberg(f, a, b, tolerance) {
    return stream_limit(
               richardson_sequence(trapezoid_sums(f, a, b),
                                   2,
                                   2),
               tolerance);
}
```
Example: Computing π with Romberg's method
```js
romberg(f, 0, 1, 1e-13);
```

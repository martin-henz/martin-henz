# Abstraction in Numerical Methods

This is a JavaScript adaptation of the Scheme programs in the MIT AI Memo 997:
> [Abstraction in Numerical Methods](https://dspace.mit.edu/handle/1721.1/6060)
by Matthew Halfant and Gerald Jay Sussman. Click [here for the full JavaScipt](https://share.sourceacademy.org/81n6d) program,
but make sure you read the paper along with the JavaScript functions.

## First example: Archimedean computation of π

Starting with the length s of any secant of 
the unit circle (for example, a secant of a hexagon)
we can compute the length of the secant of 
a "refine"ment: the length of the secant whose angle
is half the orginal (in the example, the secant of
dodecagon).
```
function refine_by_doubling(s) { // s is a side
    return s / math_sqrt(2 + math_sqrt(4 - s * s));
}
```

The function `stream_of_iterates` takes a unary function next and a value
as arguments and returns the stream that results from
iterated applications of next to the value
```
function stream_of_iterates(next, value) {
    return pair(value,
                () => stream_of_iterates(next, next(value)));
}
```
Example: compute stream of natural numbers
```
const integers = stream_of_iterates(x => x + 1, 0);
eval_stream(integers, 10);
```
For our estimation of π, we start with a square (polygon with 4 sides) and
build the stream of side_lengths 4, 8, 16, ...
```
const side_lengths = 
    stream_of_iterates(refine_by_doubling, math_sqrt(2));
eval_stream(side_lengths, 10);
```
...and the corresponding stream of numbers of sides:
```
const side_numbers = stream_of_iterates(n => 2 * n, 4);
eval_stream(side_numbers, 10);
```
```
function semi_perimeter(length_of_side, number_of_sides) {
    return number_of_sides / 2 * length_of_side;
}
```
Example: semi-perimeter of square
```
semi_perimeter(math_sqrt(2), 4); // 
```
The function `map_streams` maps two streams to a new stream, using a binary function `f`.
```
function map_streams(f, s1, s2) {
    return pair(f(head(s1), head(s2)), 
                () => map_streams(f,
                                  stream_tail(s1),
                                  stream_tail(s2)));
}
```
Now we are ready to construct our stream of π approximations.
```
const archimedean_pi_sequence =
    map_streams(semi_perimeter, side_lengths, side_numbers);
```
Look at the approximations of π:    
```
eval_stream(archimedean_pi_sequence, 26);
```
Can we converge faster?

## The Richardson toolbox

```
function make_zeno_sequence(R, h) {
    return pair(R(h), () => make_zeno_sequence(R, h / 2));
}

const two_power_fractions = make_zeno_sequence(x => x, 1);
// eval_stream(two_power_fractions, 10);
    
// accelerate zeno sequence with explictly given 
// dominant order term

function accelerate_zeno_sequence(seq, p) {
    const two_to_the_p = math_pow(2, p);
    return map_streams((Rh, Rh_over_two) =>
                         (two_to_the_p * Rh_over_two - Rh) /
                         (two_to_the_p - 1),
                       seq,
                       stream_tail(seq));
}

// compute sequence of accelerated sequences from
// the original sequence seq, the characterizing order p and increment q
function make_zeno_tableau(seq, p, q) {
    function sequences(seq, order) {
        return pair(seq,
                    () => sequences(accelerate_zeno_sequence(seq, order),
                                    order + q));
    }
    return sequences(seq, p);
}

// Richardson's method takes the first terms of each 
// accelerated sequence in the tableau
function richardson_sequence(seq, p, q) {
    return stream_map(head, make_zeno_tableau(seq, p, q));
}

// accelerating the approximation of π with with Richardson
// eval_stream(richardson_sequence(archimedean_pi_sequence, 2, 2), 7);

//
// Completing the Richardson toolbox
//

// fancy distance criterion, to take care of very small values
function is_close_enuf(h1, h2, tolerance) {
    return math_abs(h1 - h2)
           <=
           0.5 * tolerance * (math_abs(h1) + math_abs(h2) + 2);
}

// limit detector that uses fancy distance criterion
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

// automate the limit calculation of Richardson's method
// using the limit detector
function richardson_limit(f, start_h, ord, inc, tolerance) {
    return stream_limit(
               richardson_sequence(make_zeno_sequence(f, start_h),
                                   ord,
                                   inc),
               tolerance);
}

//
// Numerical computation of derivatives
//

// pedestrian derivative computation
function make_derivative_function(f) {
    return x => {
               const h = 0.00001;
               return (f(x + h) - f(x - h)) / (2 * h);
           };
}

// example: compute Df(1), where f(x) = x * x
// make_derivative_function(x => x * x)(1);

function diff_quot_stream(f, x, h) {
    return pair((f(x + h) - f(x - h)) / (2 * h),
                () => diff_quot_stream(f, x, h / 2));
}

// eval_stream(diff_quot_stream(math_sqrt, 1, 0.1), 55);

// modified version of stream_limit: taking an optional parameter
// the specifies the maximal number of stream terms to examine
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

// and the corresponding modfied version of richardson_limit
function richardson_limit_opt(f, start_h, ord, inc, tolerance, ...opts) {
    return stream_limit_opt(
               richardson_sequence(make_zeno_sequence(f, start_h),
                                   ord,
                                   inc),
               tolerance,
               array_length(opts) === 0 ? "nomax" : opts[0]);
}

// JavaScript used double-precision floating point numbers
const machine_epsilon = math_pow(2, -53);

// rederiv applies Richardson's method to the pedestrian derivative function
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

// (rderiv(math_sqrt, 1e-13))(1);

//
// Numerical integration by Romberg's method
//

// pedestrian numerical integration using the trapezoidal rule
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

// another go at estimating π: the integral of f from 0 to 1 is π
function f(x) {
    return 4 / (1 + x * x);
}

const pi_estimator = trapezoid(f, 0, 1);
// pi_estimator(10);
// pi_estimator(10000);

// we turn an estimator into a sequence...
function pi_estimator_sequence(n) {
    return pair(pi_estimator(n),
                () => pi_estimator_sequence(2 * n));
}

// ...and accelerate its convergence using Richardson's method
// eval_stream(richardson_sequence(pi_estimator_sequence(10), 2, 2), 11);

// utility function for computing the sum of f(i) where i goes 
// from a to b in steps of 1
function sigma(f, a, b) {
    function loop(sum, x) {
        return x > b 
               ? sum
               : loop(sum + f(x), x + 1);
    }
    return loop(0, a);
}

// see memo for formula S_2n (next_S)
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

// Romberg's method then boils down to applying richardson_sequence
// to the stream that results from trapezoid_sums
function romberg(f, a, b, tolerance) {
    return stream_limit(
               richardson_sequence(trapezoid_sums(f, a, b),
                                   2,
                                   2),
               tolerance);
}

// computing π with Romberg's method
// romberg(f, 0, 1, 1e-13);
```

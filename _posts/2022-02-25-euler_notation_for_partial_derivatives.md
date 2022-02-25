# Euler's Notation for Partial Derivatives

In this short post, we express Euler's notation for partial derivatives
of functions with multiple parameters using JavaScript. As usual, you find the
JavaScript program by following the link.

To illustrate the ideas, we present some simple numerical differentiation functions,
and will not worry about the precision
of the result here, so it's good to have a fixed "small" value, to use as "delta".
```js
const delta = 1e-10;
```
(We choose this `delta` to be small, but not too small. For precise methods
of numerical differentiation, see [an earlier post](https://martin-henz.github.io/martin-henz/2022/02/13/abstraction-in-numerical-methods.html).)

A simple example of a function in one argument is the  `square` function.
```js
const square = x => x * x;
```
A simple numerical differentiation function 
follows the definition of derivatives, using Lagrange's notation:
`f'(x) = (f(x + d) - f(x)) / d`, where `d` approaches 0
```js
const differentiate = f => x => (f(x + delta) - f(x)) / delta;
```
Using this `differentiate` function, we can differentiate `square` as follows.
```
differentiate(square);    // returns a function square'
                          // approximately square'(x) = 2 * x
```
Applying the function that results from differentiating `square` to 1
gives approximately 2.
```js
differentiate(square)(1);
```
The square function above only has one argument, so when
we write `square'`, it is clear what argument we are 
differentiating for.

The problem with Lagrange's notation is that it doesn't
spell out which parameter we are differentiating for 
when there are multiple parameters.

For functions with multiple parameters, we would like
to compute a partial derivative by changing one value
and leave the other values unchanged.

For example, we would like to compute the partial 
derivative of
`f(x, y) = x² + x y + y²`
separately with respect to `x`, and with respect to `y`.

Euler's notation uses the parameter name for this, 
regardless of its position in the list of arguments:
`(Dx f)(x, y) = (f(x + delta, y) - f(x, y)) / delta`

and
`(Dy f)(x, y) = (f(x, y + delta) - f(x, y)) / delta`
    
To achieve this in JavaScript, we need to associate the
names of the parameters with each function. The simplest
method is to treat the function as an object and add
a property `argnames` to the function after declarating it.
```js
const f = (x, y) => square(x) + x * y + square(y);
f.argnames = ["x", "y"]; 
```
With this, we know that the first parameter of `f`
has the name `"x"` and the second parameter has
the name `"y"`. We do the same for the square function
above.
```js
square.argnames = ["x"];
```
We can define Euler's function D as a function
that takes a named parameter "name" as argument and
returns a differentiation function: A function
that differentiates a function with repect to "name".
```js
const D = name => f => (...x) => (f(...add_to_named(x, f, name, delta)) 
                                  - f(...x)) 
                                 / delta;
```
The helper function `add_to_named` adds a given `delta` to the value in
`values` that is named by `name`, according to the
parameter names of `f`:
```js
const add_to_named = (values, f, name, delta) =>
                                 values.map((x, i) => f.argnames[i] === name
                                 ? x + delta
                                 : x);
```
Now we can apply Euler's function `D` to `"x"` and `f` and get
the partial derivative of `f` with respect to parameter `"x"`.
```js
D("x")(f);                  // returns Dx f
display(D("x")(f)(1, 2));   // returns Dx f(1, 2), approximately 4
```
In the same way, we can use `D` to differentiate the square function.
```js
D("x")(square);    // returns approx Dx square: a function square'(x) = 2 * x
D("x")(square)(1); // returns approximately square'(1) = 2
```
The Nabla function (usually denoted by the symbol ∇) takes a
multi-parameter function `f` as argument
and returns a multi-parameter function that returns the gradient
vector of `f` at the given position. In JavaScript, the Nabla function
can be defined using `D` as follows:
```js
const Nabla = f => (...x) => f.argnames.map((name, i) => D(name)(f)(...x));
```
For example, we can apply `Nabla` to `f`.
```js
Nabla(f);          // the Nabla function of f
Nabla(f)(1, 2); // the gradient vector of f at position (1,2),
                   // approximatately [4, 5]
```


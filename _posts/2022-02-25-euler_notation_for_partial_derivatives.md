# Euler's Notation for Partial Derivatives

In this short post, I express Euler's notation for partial derivatives
of scalar functions with multiple parameters using JavaScript. As usual, you find the
JavaScript program by [following the link](https://share.sourceacademy.org/eulernotation),
but this time, you need to change the language from Source §4 to "full JavaScript".

## The Single-parameter Case

To illustrate the ideas, I present some simple numerical differentiation functions,
and will not worry about the precision
of the result here, so it's good to have a fixed "small" but not too small value,
to use as "delta".
```js
const delta = 1e-10;
```
(For precise methods
of numerical differentiation, see [an earlier post](https://martin-henz.github.io/martin-henz/2022/02/13/abstraction-in-numerical-methods.html).)

An example of a scalar function with one parameter is the  `square` function.
```js
const square = x => x * x;
```
A simple numerical differentiation function 
follows the definition of derivatives, using Lagrange's notation:
`f'(x) = (f(x + d) - f(x)) / d`, where `d` approaches 0. Using our fixed `delta`, you can write:
```js
const differentiate = f => x => (f(x + delta) - f(x)) / delta;
```
Using this `differentiate` function, you can differentiate `square` as follows.
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
you write `square'`, it is clear what argument you are 
differentiating for.

## Multiple Parameters

The problem with Lagrange's notation is that it doesn't
spell out which parameter(s) you are differentiating for 
when there are multiple parameters.

For functions with multiple parameters, you would like
to compute a *partial derivative* by changing one value
and leave the other values unchanged.

For example, you would like to compute the partial 
derivative of
`f(x, y) = x² + x y + y²`
separately with respect to `x`, and with respect to `y`.

Euler's notation uses the parameter name for this, 
regardless of its position in the list of arguments:
`(Dx f)(x, y) = (f(x + delta, y) - f(x, y)) / delta`

and
`(Dy f)(x, y) = (f(x, y + delta) - f(x, y)) / delta`

## Getting Function Parameters in JavaScript

To achieve this in JavaScript, you need to associate the
names of the parameters with each function. There isn't
any simple way to do this in JavaScript. See
[here for an approach I adopted and improved a bit](https://www.geeksforgeeks.org/how-to-get-the-javascript-function-parameter-names-values-dynamically/).
```js
function parameters(f) {
    // string representation of the function
    let str = f.toString();
    // remove comments of the form /* ... */
    // remove comments of the form //
    // remove '{...' if f is function declaration
    // removing '=>...' if f is arrow function
    str = str.replace(/\/\*[\s\S]*?\*\//g, '')
             .replace(/\/\/(.)*/g, '')
             .replace(/{[\s\S]*/, '')
             .replace(/=>[\s\S]*/g, '')
             .trim();
    // start parameter names after first '('
    const start = str.indexOf("(") + 1;
    // end parameter names is just before last ')' if there is one
    const end = str.indexOf(")") === -1 ? str.length : str.length - 1;
    const result = str.substring(start, end).split(", ");
    const params = [];
    result.forEach(element => {
        // remove any default value
        element = element.replace(/=[\s\S]*/g, '').trim();
        if(element.length > 0)
            params.push(element);
    });
    return params;
}
```
If you write the function *`f(x, y) = x² + x y + y²` as
```js
const f = (x, y) => square(x) + x * y + square(y);
```
you can access its parameters by
```js
parameters(f);   // returns the vector ["x", "y"]
```
Similarly, your retrieve the parameters of `square` by
```js
parameters(square); // returns the vector ["x"]
```

## Euler's Notation for Partial Derivatives

Now, I define Euler's D notation as a function `D`
that takes a named parameter "name" as argument and
returns a function transformer: A function
that differentiates a given scalar function with repect to "name".
```js
const D = name => f => (...x) => (f(...add_to_named(x, f, name, delta)) 
                                  - f(...x)) 
                                 / delta;
```
The helper function `add_to_named` adds a given `delta` to the value in
`values` that is named by `name`, according to the
parameter names of `f`:
```js
const add_to_named = (values, f, name, delta) => {
                         const params = parameters(f);
                         return values.map((x, i) => params[i] === name
                                                     ? x + delta
                                                     : x);
                     };
```
Now we can apply Euler's function `D` to `"x"` and `f` and get
the partial derivative of `f` with respect to parameter `"x"`.
```js
D("x")(f);         // returns Dx f
D("x")(f)(1, 2);   // returns Dx f(1, 2), approximately 4
```
In the same way, we can use `D` to differentiate the square function.
```js
D("x")(square);    // returns approx Dx square: a function square'(x) = 2 * x
D("x")(square)(1); // returns approximately square'(1) = 2
```

## The Nabla Function

The Nabla function (usually denoted by the symbol ∇) takes a
multi-parameter scalar function `f` as argument
and returns a multi-parameter function that returns the gradient
vector of `f` at the given position. In JavaScript, the Nabla function
can be defined using `D` as follows:
```js
const Nabla = f => (...x) => parameters(f).map((name, i) => D(name)(f)(...x));
```
For example, we can apply `Nabla` to the function `f` above as follows.
```js
Nabla(f);          // the Nabla function of f

Nabla(f)(1, 2);    // the gradient vector of f at position (1,2),
                   // approximatately [4, 5]
```


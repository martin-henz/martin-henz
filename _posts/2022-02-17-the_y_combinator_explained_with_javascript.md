---
tags: Random
---

# The What, How, and Why of Y

## The What of Y

The following JavaScript expression is called the *applicative-order Y combinator*
```js
f => (g => g(g))(g => f(y => g(g)(y)))
```
What is interesting about this incomprehensible mess of lambda expressions, which
includes something as strange as `g(g)` not once but twice?

The first Y combinators were conceived by [Haskell Curry](https://en.wikipedia.org/wiki/Haskell_Curry)
to show that a minimal language consisting just of expressions `E`
of the forms `x => E` (lambda abstraction) and `E1(E2)` (function application)
in principle suffices to express every algorithm. More specifically, the applicative-order
Y combinator allows
us to express recursive algorithms in a sublanguage of JavaScript that does not include
declarations.
Take for example the factorial function, and recall
`factorial(5) = 5 * 4 * 3 * 2 * 1 = 24`. Using the Y combinator, we can compute `factorial(5)`
[as follows](https://share.sourceacademy.org/01tj0) (click on the link to run the program, also in rest of this post):
```js 
Y(given_fact => n => n <= 1 ? 1 : n * given_fact(n - 1))(5);
// returns 5! = 120
```

## The How of Y

But how does this Y combinator achieve this? The property needed in a language that
uses applicative-order reduction, such as JavaScript, is as follows:
An application `Y(f)` where `f` is a lambda abstraction should lead to some lambda
abstraction `E` such that `E(n)` leads to `f(E)(n)`.
If `Y` has this property, we can compute `5!` by applying `Y` to the following function as `f`:
```js
given_fact => n => n <= 1 ? 1 : n * given_fact(n - 1)
```
Now `Y(f)(n)` leads to `f(E)(n)`, and the recursive call `given_fact(n - 1)` in `f`
will become `E(n - 1)`, which will become `f(E)(n - 1)`, and so on, until we reach
the base case `n <= 1`, which leads to 1 and `E` is no more needed. Then we only need
to carry out the accumulated multiplications `5 * (4 * (3 * (2 * 1)))` to obtain the correct
result 120.

## The Why of Y

The following explanation is adapted from a [blog post 
by Kestas
Kuliukas](https://kestas.kuliukas.com/YCombinatorExplained/), who in turn was inspired by
[Douglas Crockford on JavaScript - Act III: Function the
Ultimate](http://youtu.be/ya4UHuXNygM?t=1h8m42s). I took the liberty
to modernize the JavaScript, and revise the presentation.

It is hard to figure out how the Y combinator achieves recursion
because of its lack of declarations; declarations are what
make computer programs understandable, and the Y combinator is
specifically designed to work without them, to prove the point Curry was making.

Consider a conventional implementation of the factorial function in JavaScript,
using a [constant declaration](https://share.sourceacademy.org/fzdsl):
```js
const recursive_fact = n => n <= 1 ? 1 : n * recursive_fact(n - 1);
```
If `n` is less than or equal to 1 return 1, otherwise multiply `n` by
`recursive_fact(n - 1)`.
However, we would like to achieve this *without* declarations.
The `recursive_fact` function refers to `recursive_fact` within its own body.
How can we
recursively call the factorial function without creating a reference to
the factorial function? The first idea is to pass the factorial function as
a parameter, and have [a function which returns the factorial function](https://share.sourceacademy.org/9vupa)
rather than declare it.
```js
const make_fact =
    given_fact => {
        const fact = n => n <= 1 ? 1 : n * given_fact(n - 1);
        return fact;
    };
```
The problem is that without a "`given_fact`" function (such as `recursive_fact` above)
we can't call `make_fact`.
It seems like we can't use this approach because we can't use `make_fact` to
make a factorial function without already having a factorial function to begin with!
It turns out that it is possible though, because the `fact` function which
`make_fact` makes doesn't always call `given_fact`. Instead of passing in a
pre-made `given_fact` we can make `given_fact` itself use `make_fact`, until
`make_fact` makes a `fact` call which doesn't need to call `given_fact`.
```js
const make_real_fact =
    make_fact => {
        const try_fact = n => {
                             const next_try_fact = make_fact(try_fact);
                             return next_try_fact(n);
                         };
        return make_fact(try_fact);
    };
```
The function `make_real_fact` (the first version of our Y combinator)
uses a given `make_fact` function to make the actual factorial function.
The `try_fact` function is passed to `make_fact` to be used as its `given_fact` function.
If `make_fact` needs to use `given_fact` it will call `try_fact`,
which will make another `try_fact` using `make_fact` and try again.
Eventually `make_fact` will be able to return a factorial function which doesn't
use `given_fact`, which can then be used to find a `given_fact`, and that used to
find another `given_fact`, and so on. Using `make_real_fact` we can compute
the factorial function [as follows](https://share.sourceacademy.org/7l5a8).
```js
make_real_fact(given_fact => n => n <= 1 ? 1 : n * given_fact(n - 1))(5);
```
This approach is like using `make_fact` to keep working on the `try_fact` function,
assuming `make_fact` will always need a simpler `try_fact` function until it finds
a way to `make_fact` without needing `try_fact`. Note the recursion in action,
without having to declare a recursive factorial function.

The application `next_try_fact(n)` will lead to recursive calls
`try_fact(n)`-`next_try_fact(n)`-`try_fact(n - 1)`-`next_try_fact(n - 1)`-etc until
`next_try_fact(1)` is reached, returning a value without needing to use `given_fact`.

There is still a problem though; `try_fact` references itself in
`const next_try_fact = make_fact(try_fact);`, so it doesn't solve the problem of getting
rid of all declarations.
Another function needs to be created to keep on cycling through `try_fact`-`next_try_fact`,
without `try_fact` having to reference itself.
The `get_next_try_fact` function will return the next `try_fact` function to `try_fact`,
so it doesn't have to refer to itself, [as shown here](https://share.sourceacademy.org/efg1e):
```js
const make_real_fact =
    make_fact => {
        const get_next_try_fact =
            () => {
                const try_fact = n => {
                                     const next_try_fact = get_next_try_fact();
                                     const result = next_try_fact(n);
                                     return result;
                                 };
                const next_try_fact = make_fact(try_fact);
                return next_try_fact;
            };
        return get_next_try_fact();
    };
```
Instead of `try_fact` passing itself to `make_fact` until it isn't needed it calls
`get_next_try_fact`, which passes `try_fact` to `make_fact` for it.

But now `get_next_try_fact` needs to refer to itself, so we need a way to refer to
`get_next_try_fact` without declaring it.
This is done by passing `get_next_try_fact` to itself as a parameter, and is
[the final adjustment](https://share.sourceacademy.org/l2w8x) needed to remove all self-referencing functions.
```js
const make_real_fact =
    make_fact => {
        const get_next_try_fact =
          get_next_try_fact_ref => {
              const try_fact =
                  n => {
                      const next_try_fact =
                          get_next_try_fact_ref(get_next_try_fact_ref);
                      const result = next_try_fact(n);
                      return result;
                  };
              const next_try_fact = make_fact(try_fact);
              return next_try_fact;
          };
        return get_next_try_fact(get_next_try_fact);
    };
```
Now we have a function which can make a factorial function using the `make_fact`
function recursively, without ever needing to refer to its own variables/functions
via labels; everything can be accessed via parameters. (`get_next_try_fact_ref` is a
reference to the `get_next_try_fact` function, maintained using parameters rather
than a variable declaration.)

Obviously declarations are still used though, so now we need to eliminate them.
From here on the function gets much less readable, but we show that it truly doesn't
need variable declarations, and thus show how it is equivalent to the Y function above.

First the `try_fact` function [is passed directly](https://share.sourceacademy.org/05tas) to `make_fact`, without being declared.
```js
const make_real_fact =
    make_fact => {
        const get_next_try_fact =
            get_next_try_fact_ref => {
                const next_try_fact =
                    make_fact(n => {
                                  const next_try_fact =
                                    get_next_try_fact_ref(get_next_try_fact_ref);
                                  const result = next_try_fact(n);
                                  return result;
                              });
                return next_try_fact;
            };
        return get_next_try_fact(get_next_try_fact);
    };
```
Next the inner-most next_try_fact function is used to generate a result [without being declared](https://share.sourceacademy.org/e9alg).
```js
const make_real_fact =
    make_fact => {
        const get_next_try_fact = 
            get_next_try_fact_ref => {
                const next_try_fact =
		    make_fact(n => {
                                 // Already it's becoming cryptic
                                 const result = get_next_try_fact_ref(
				                    get_next_try_fact_ref)(n);
                                 return result;
                             });
                return next_try_fact;
            };
        return get_next_try_fact(get_next_try_fact);
    };
```    
Next the `result` is returned [without being declared](https://share.sourceacademy.org/ok3ki).
```js
const make_real_fact =
    make_fact => {
        const get_next_try_fact =
	    get_next_try_fact_ref => {
                const next_try_fact =
		    make_fact(n => get_next_try_fact_ref(
				       get_next_try_fact_ref)(n));
                return next_try_fact;
            };
        return get_next_try_fact(get_next_try_fact);
    };
```
Next the outer `next_try_fact` function is returned directly [without being declared](https://share.sourceacademy.org/zd0xe).
```js
const make_real_fact =
    make_fact => {
        const get_next_try_fact =
	    get_next_try_fact_ref => 
                make_fact(n => get_next_try_fact_ref(
			           get_next_try_fact_ref)(n));
        return get_next_try_fact(get_next_try_fact);
    };
```
Because	`get_next_try_fact` is used twice on the same line a label is needed to refer to
the same thing twice. This has to be done by passing it to a function as a parameter,
so the parameter [can be used as a label to refer to the same thing twice](https://share.sourceacademy.org/i0j9y).
```js
const make_real_fact =
    make_fact => {
        const get_next_try_fact =
	    get_next_try_fact_ref =>
                make_fact(n => get_next_try_fact_ref(
		                  get_next_try_fact_ref)(n));
        return (get_next_try_fact_ref =>
                    get_next_try_fact_ref(get_next_try_fact_ref))
               (get_next_try_fact);
    };
```
Finally the `get_next_try_fact` function is [passed directly to the nameless function](https://share.sourceacademy.org/t8sjo)
which calls `get_next_try_fact` on itself to start the recursion going.
```js
const make_real_fact =
    make_fact => (get_next_try_fact_ref =>
                      get_next_try_fact_ref(get_next_try_fact_ref))
                 (get_next_try_fact_ref =>
                      make_fact(n => get_next_try_fact_ref(
	 	                   get_next_try_fact_ref)(n)));
```
We've gotten rid of the declarations of `try_fact`, `next_try_fact`, `result`, and
`get_next_try_fact`, leaving a function which has no declarations, only parameters.
All that is needed now is to rename
`make_fact` to `f`,
`get_next_try_fact_ref` to `g`,
`n` to `y`, and
`make_real_fact` to `Y`,
get rid of some white-space,
and we have the Y combinator function as it was given above.
```js
const Y = f => (g => g(g))(g => f(y => g(g)(y)));
```
Although we made it for the factorial function the Y combinator can be used for any
recursive function, showing that recursion can be done without declarations, just with
lambda expressions and function application.
The same Y combinator can be used to make a
[factorial function](https://share.sourceacademy.org/9yscv)...
```js
const make_fact = given_fact =>
                      n => n <= 1 ? 1 : n * given_fact(n - 1);
const fact = Y(make_fact);
display(fact(5)); // Outputs 120
```
...and a [fibonacci function](https://share.sourceacademy.org/zipno):
```js
const make_fib = given_fib =>
                   n => n <= 2 ? 1 : given_fib(n - 1) + given_fib(n - 2);
const fibonacci = Y(make_fib);
display(fibonacci(5)); // Outputs 5
```
Or, if you want to [get rid of all declarations completely](https://share.sourceacademy.org/dzpvt):
```js
(Y => {
    display(Y(given_fact =>
                  n => n <= 1 ? 1 : n * given_fact(n - 1))(5));
    display(Y(given_fib =>
                  n => n <= 2 ? 1 : given_fib(n - 1) + given_fib(n - 2))(5));
})(f => (g => g(g))(g => f(y => g(g)(y))));
```
Not a declaration in sight!

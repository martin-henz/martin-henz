---
tags: Random
---

# Unit Circle Art

>
> But out of limitations comes creativity.

Debbie Allen 

>
> The enemy of art is the absence of limitations.

Orson Welles

## Curves

The art form I develop in this post involves colored 
*curves* in two dimensions. Such a curve can be represented by a 
function from a number range, here [0, 1], to a set of 
colored *points*, where a point has an x and y coordinate, and 
"rgb" (red-green-blue) values to represent its color.

For example, the following function `diagonal` represents a 
diagonal line
```js
const diagonal = t => make_color_point(t, t, 0, 255, 0);
```
because it maps each value `t` to a point `(t,t)`, which means
that x and y coordinates increase from the lower left to the
upper right.
The line is green because the "red" value is 0, the "green" value
is 255 (the maximum rgb value), and the "blue" value is 0.
The programs in this post are
[available here](https://share.sourceacademy.org/unitcircleart);
to see the images, uncomment the lines that start with
`//draw_connected_full_view...`.

You can visualize curves with the function `draw_connected_full_view`,
which takes a number `n` as argument and returns a function that
can be applied to a curve to visualize it. For that, the
curve is applied to `n + 1` values, 0, 1, ..., `n`, and the 
resulting points displayed so that they all fit on the screen, 
and are connected with each other with straight lines.

The following application draws the `diagonal` curve
by applying `diagonal` to the values 0, 0.25, 0.5, 0.75, and 1,
and the resulting points are connected.
```js
draw_connected_full_view(4)(diagonal);
```
<img src="/martin-henz/images/unit_circle_art/green_diagonal.png" alt="green diagonal" width="400"/>

## The Unit Circle

Similarly, you can draw a red circle using the trigonometric
functions of sine and cosine:
```js
const π = math_PI; 
const unit_circle = t => make_color_point(
    math_cos(2 * π * t),                                       // x
    math_sin(2 * π * t),                                       // y
    255, 0, 0);                                              // rgb
draw_connected_full_view(100)(unit_circle);
```
<img src="/martin-henz/images/unit_circle_art/red_unit_circle.png" alt="red circle" width="400"/>

This circle is called the "unit circle" because it results from
drawing a circle of radius 1 whose center has coordinate (0,0).

If you play with the rgb values, you can achieve a
multi-colored unit circle:
```js
const colored_unit_circle = t => make_color_point(
    math_cos(2 * π * t),                                       // x
    math_sin(2 * π * t),                                       // y
    math_pow(math_cos(2 * π * t), 2) * 255,                    // r
    math_pow(math_sin(2 * π * t), 2) * 255,                    // g
    math_pow(math_cos(    π * t), 2) * 255);                   // b
draw_connected_full_view(100)(colored_unit_circle);
```
<img src="/martin-henz/images/unit_circle_art/colored_unit_circle.png" alt="colored circle" width="400"/>

In this post, I constrain myself to connecting points on this
colored unit circle with straight lines, and turn this into an "art form".

## Connecting Points on the Unit Circle

The following abstraction `connect_points` comes in handy.
It takes a number `n` and a function `f` as arguments and connects
`n` points with each other. The points result from applying
the colored unit circle to values 
`f(0) / n`, `f(1) / n`, ..., `f(n) / n`
```js
const connect_points =
    (n, f) =>
        draw_connected_full_view(n)
        (t => colored_unit_circle(f(math_round(t * n)) / n));
```
In the case where `f` is the identity function, you just 
connect `n` points on the unit circle with each other, and
get a regular polygon with `n` vertices:
```js
connect_points(5, k => k);
```
connecting the points
`0 / n`, `1 / n`, `2 / n`, ..., `n / n`

<img src="/martin-henz/images/unit_circle_art/cp_5_1.png" alt="pentagon" width="400"/>

The unit circle wraps around, if you apply it to values
greater than 1, so you can obtain star shapes by connecting
multiples of the given value.
```js
connect_points(5, k => k * 2);
```
yields a pentagram

<img src="/martin-henz/images/unit_circle_art/cp_5_2.png" alt="pentagram" width="400"/>

because you connect the points
`0 / 5`, `2 / 5`, `4 / 5`, `6 / 5`, `8 / 5`, and `10 / 5`.

In the same way, you can create a star shape by connecting
the corners of a 50-vertex polygon with each other such
that each point is connected to the point 21 positions
further, in counterclockwise direction:
```js
connect_points(50, k => k * 21);  
```

<img src="/martin-henz/images/unit_circle_art/cp_50_21.png" alt="50-vertex star" width="400"/>

Choosing random values on the circle also leads to
an intriguing pattern, when you choose n large enough:
```js
connect_points(1000, k => 1000 * math_random());
```

<img src="/martin-henz/images/unit_circle_art/cp_1000_random.png" alt="random" width="400"/>

## Equation Signatures

Every equation seems to have a particular "signature"
image in this art form. Here are some examples.
```js
connect_points(6561, k => k * k );
```
<img src="/martin-henz/images/unit_circle_art/cp_6561_2.png" alt="connect points 6561" width="400"/>
```js
connect_points(1024, k => k * k * k + 3 * k * k + 3 * k + 1);
```
<img src="/martin-henz/images/unit_circle_art/cp_1024_1_3_3_1.png" alt="connect points 1024 1-3-3-1" width="400"/>
```js
connect_points(256, k => k * k * k * k);
```
<img src="/martin-henz/images/unit_circle_art/cp_256_4.png" alt="connect points 256 k^4" width="400"/>
```js
connect_points(512, k => k * k * k * k);
```
<img src="/martin-henz/images/unit_circle_art/cp_512_4.png" alt="connect points 512 k^4" width="400"/>
```js
connect_points(512, k => k * k * k * k * k); 
```
<img src="/martin-henz/images/unit_circle_art/cp_512_5.png" alt="connect points 512 k^5" width="400"/>
```js
connect_points(84, k => k * k * k * k * k * k * k);
```
<img src="/martin-henz/images/unit_circle_art/cp_84_7.png" alt="connect points 84 k^7" width="400"/>

## Connecting Lines

Another way of connecting points on the unit circle using
a function `f` is to draw a line from `i` to `f(i)`, for each `i`
from 0 to `n`. That can be accomplished using the `connect_points`
abstraction, by connecting (1) the point at `i` with (2) the
point at `f(i)`, then (3) going back to `i`, which explains the
occurrences of the number 3 in the program.
```js
const connect_lines =
    (n, g) =>
    connect_points(n * 3,
                   k => { const v = math_round((k - 1) / 3);
                          return k % 3 === 1 ? g(v) * 3 : v * 3; }
                  );
```
Connecting the every point with point 0 yields a picture like this.
```js
connect_lines(150, k => 0);
```
<img src="/martin-henz/images/unit_circle_art/cl_150_0.png" alt="connect lines 150" width="400"/>

which you can turn in counterclockwise direction
by using a non-zero destination point, here point 25.
```js
connect_lines(150, k => 25);
```
<img src="/martin-henz/images/unit_circle_art/cl_150_25.png" alt="connect lines 150 offset 25" width="400"/>

Connecting the points with a point that results from applying
the modulo operator % yields intriguing interference patterns.
```js
connect_lines(150, k => k % 3); 
```
<img src="/martin-henz/images/unit_circle_art/cl_150_3.png" alt="connect lines 150 modulo 3" width="400"/>
```js
connect_lines(150, k => k % 11);
```
<img src="/martin-henz/images/unit_circle_art/cl_150_11.png" alt="connect lines 150 modulo 11" width="400"/>
```js
connect_lines(300, k => k % 11); 
```
<img src="/martin-henz/images/unit_circle_art/cl_300_11.png" alt="connect lines 300 modulo 11" width="400"/>
```js
connect_lines(250, k => k % 11+160);
```
<img src="/martin-henz/images/unit_circle_art/cl_250_11_160.png" alt="connect lines 250 modulo 11 offset 160" width="400"/>
```js
connect_lines(250, k => k % 10 + k / 10);
```
<img src="/martin-henz/images/unit_circle_art/cl_250_10_10.png" alt="connect lines 250 modulo 10 plus k over 10" width="400"/>
```js
connect_lines(1000, k => k % 25 * 7); 
```
<img src="/martin-henz/images/unit_circle_art/cl_1000_25_7.png" alt="connect lines 1000 modulo 25 times 7" width="400"/>

## Drawing Times Tables

Connecting points with their multiples leads to a visualization
of "times tables". The Mathologer has
[a video on this genre of unit circle art](https://www.youtube.com/watch?v=qhbuKbxJsk8).
You can draw times tables with the abstraction `draw_times_table`:
```js
const draw_times_table =
    (n, m) => connect_lines(n, k => k * m);
```
The times table for 2 is called the *cardiod*.
```js
draw_times_table(200,  2);      // m = 2: cardioid: 1 lobe
```
<img src="/martin-henz/images/unit_circle_art/tt_200_2.png" alt="times table modulo 200 times 2" width="400"/>

The times table for 3 is called the *nephroid*.
```js
draw_times_table(200, 3);      // m = 3: nephroid: 2 lobes
```
<img src="/martin-henz/images/unit_circle_art/tt_200_3.png" alt="times table modulo 200 times 3" width="400"/>

The number of "lobes" of the picture increases with `m`: For
`m = 4` you get 3 lobes, etc.
```js
draw_times_table(200, 4);      // m = 4: 3 lobes...
```
<img src="/martin-henz/images/unit_circle_art/tt_200_4.png" alt="times table modulo 200 times 4" width="400"/>

Specific relationships between `n` and `m` create interesting
visual patterns. For `n = 397` and `m = 200`, you get a variant
of the cardiod...
```js
draw_times_table(397, 200);    // m = (n + 3) / 2: cardioid
```
<img src="/martin-henz/images/unit_circle_art/tt_397_200.png" alt="times table modulo 397 times 200" width="400"/>

...and for `n = 500` and `m = 252`, you get a variant of the
nephroid.
```js
draw_times_table(500, 252);    // m = (n + 4) / 2: nephroid
```
<img src="/martin-henz/images/unit_circle_art/tt_500_252.png" alt="times table modulo 500 times 252" width="400"/>

If you play with the numbers, you observe what relationship
between `n` and `m` gives rise to what kind of picture. Enjoy!
```js
draw_times_table(501, 253);    // m = (n + 5) / 2: 3 lobes...
```
<img src="/martin-henz/images/unit_circle_art/tt_501_253.png" alt="times table modulo 501 times 253" width="400"/>
```js
draw_times_table(500, 168);    // m = (n + 4) / 3: cardioid
```
<img src="/martin-henz/images/unit_circle_art/tt_500_168.png" alt="times table modulo 500 times 168" width="400"/>
```js
draw_times_table(295, 100);    // m = (n + 5) / 3: nephroid
```
<img src="/martin-henz/images/unit_circle_art/tt_295_100.png" alt="times table modulo 295 times 100" width="400"/>
```js
draw_times_table(594, 200);    // m = (n + 6) / 3: 3 lobes...
```
<img src="/martin-henz/images/unit_circle_art/tt_594_200.png" alt="times table modulo 594 times 200" width="400"/>
```js
draw_times_table(395, 100);    // m = (n + 5) / 4: cardioid
```
<img src="/martin-henz/images/unit_circle_art/tt_395_100.png" alt="times table modulo 395 times 100" width="400"/>
```js
draw_times_table(494, 100);    // m = (n + 6) / 5: cardioid
```
<img src="/martin-henz/images/unit_circle_art/tt_494_100.png" alt="times table modulo 494 times 100" width="400"/>
```js
draw_times_table(593, 100);    // m = (n + 7) / 6: cardioid
```
<img src="/martin-henz/images/unit_circle_art/tt_593_100.png" alt="random" width="400"/>
```js
draw_times_table(400, 201);    // m = n / 2 + 1 (/4,/8,/16)
```
<img src="/martin-henz/images/unit_circle_art/tt_400_201.png" alt="random" width="400"/>
```js
draw_times_table(400, 199);    // m = (n / 2) - 1: square
```
<img src="/martin-henz/images/unit_circle_art/tt_400_199.png" alt="random" width="400"/>

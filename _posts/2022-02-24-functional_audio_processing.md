---
tags: Random
---

# Functional Audio Processing

Functions are among the first things you will learn when you pick up JavaScript.
Sounds are pressure waves traveling through the air, and a wave can be regarded
as a function from
time to the amplitude of the wave at that time. In this blog post, I'm exploring
the use of sound to learn how JavaScript functions are used.
[Click here](https://share.sourceacademy.org/wave) to play.

## The first beeps

We will use the number π (3.14...) a few times, so we should declare it as a
constant.
```js
const π = math_PI;
```
Some functions are built into the language. For example, JavaScript knows the
sine function as `Math.sin`. In the Source dialect, this function is called
`math_sin`. You can apply a function using the usual mathematical notation:
```js
math_sin(1); // returns sin(1), about 0.84
```
One way to make a new function in JavaScript is with a lambda expression,
for example
```
t => math_sin(2 * π * t * 440)
```
represents the function that takes an argument `t` and returns the result
of applying `math_sin` to `2 * π * t * 440`. That's our first sound wave:
If `t` is the time measured in seconds, this function represents a sound
wave with frequency 440 Hertz. That means the sound wave oscillates between
-1 and 1 exactly 440 times per second. The function `play_wave` makes such
waves audible.
```js
play_wave(t => math_sin(2 * π * t * 440), 1);
```
The duration of the sound is determined by the second argument measured in
seconds, here 1.

Instead of fixing the frequency of the sound, we can write a function
`sine_wave` that takes a frequency `f` as argument and returns a sound
wave with that frequency.
```js
const sine_wave = f => t => math_sin(2 * π * t * f);
play_wave(sine_wave(880), 1);
```
If you wonder how the `play_wave` function does its magic, you can
apply `display` to the result of the wave function. For a sound with
a duration of 100 microseconds, you may see around 10 values, depending
on your browser. That means that
`play_wave` samples the wave at a frequency of about 100 kilohertz
in order to digitize the sound to make it audible on your computer.
```js
const sine_wave_ = f => t => display(math_sin(2 * π * t * f));
play_wave(sine_wave_(440), 0.0001); // how many values do you see?
```
If your sound system is stereo, you can send different sine waves
to each of your two speakers, using the function `play_waves`.
```js
play_waves(sine_wave(440), sine_wave(660), 1);
```
*White noise* can be produced by choosing a random value between -1 and
1 as amplitude, each time `play_wave` calls the wave function.
```js
const noise = t => math_random() * 2 - 1;
play_wave(noise, 1);
```
Here is a more interesting sound: A sine wave whose frequency
changes, following a sine-wave pattern. This is done by adding a
changing offset to the argument of the outer sine function.
The result is a sound reminiscent of an American police siren.
```js
function police(base_freq, mod_freq, mod_ind) {
    return t => math_sin(2 * π * t * base_freq + 
                         mod_ind * math_sin(2 * π * t * mod_freq));
}
const boston_police = police(900, 3, 30);
play_wave(boston_police, 2);
```
Notice the function declaration, which is an alternative way
in JavaScript to give a name to a function.

## Wave Transformations

You can achieve a simple fast-forward effect by "shrinking" time:
multiplying the time factor with a given value `r` before applying
a given wave function to it.
```js
function fast_forward(r) {
    return w => t => w(t * r);
}
play_wave(boston_police, 2);
play_wave(fast_forward(1.2)(boston_police), 2);
```
Note that the function `fast_forward` returns a *wave transformation*,
which is a function that takes a wave as argument and returns a wave.
It is interesting to note that white noise as implemented above
is invariant under any `fast_forward` function.
```js
play_wave(noise, 2);
play_wave(fast_forward(2)(noise), 2);
```
The function `delay` returns a wave transformation
that delays a given wave by a given number of seconds, and
the function `cut` returns a wave transformation that cuts
a given wave to be non-zero only in a given interval, also
given in seconds.
```js
// delays given wave by d seconds
function delay(d) {
    return w => t => t < d ? 0 : w(t - d);
}

const delay_1 = delay(2);

play_wave(delay_1(sine_wave(1000)), 3);

// cut makes wave transformer that cuts given wave 
// to start at time t_start and end at time t_end
function cut(t_start, t_end) {
    return w => t => (t < t_start || t > t_end) ? 0 : w(t);
}

play_wave(cut(1, 1.2)(sine_wave(1000)), 3);
```

## Binary Operations on Waves

Our first *binary operation* on waves averages their amplitudes
and is used for combining two waves concurrently so that the
applitude of the result remains between -1 and 1.
```js
// binary wave operator: average amplitudes
function average(w1, w2) {
    return t => (w1(t) + w2(t)) / 2;
}

const short_high = cut(0, 0.5)(sine_wave(1000));

const long_low = cut(0, 1)(sine_wave(500));

play_wave(long_low, 4);

play_wave(average(short_high, delay(0.2)(long_low)), 3);
```
If we concurrently play two waves whose frequencies differ
by a small number, our ears pick up an interference pattern.
```js
const interference_1 = average(sine_wave(435), sine_wave(450));
play_wave(interference_1, 1);

const interference_2 = average(sine_wave(580), sine_wave(600));
play_wave(interference_2, 1);
```
If two waves are to be combined sequentially and if they
don't overlap, it is better to just add their amplitudes
so that the amplitudes of the orginal waves is preserved.
```js
// binary wave operator: add amplitudes
function add(w1, w2) {
    return t => w1(t) + w2(t);
}
```
The `sequence` function combines two waves by adding them
such that the second wave follows the first after a delay
specified by a parameter `d` in seconds.
```js
// wave operator: sequence two wave with delay d
function sequence(w1, d, w2) {
    return add(cut(0, d)(w1), delay(d)(w2));
}
const german_fire = sequence(interference_1, 1, interference_2);
play_wave(german_fire, 2);            
```
Repeating a given sound at intervals of a duration `d` given
in seconds just applies the modulo operator `%` to the time
`t` and to the duration `d`.
```js
// repeat_every makes wave transformer
// that repeats a given wave every d seconds
function repeat_every(d) {
    return w => t => w(t % d);
}

play_wave(repeat_every(2)(german_fire), 8);
```

## Wave Envelopes

*Envelopes* are an important concept in sound processing
where a given wave waxes and wanes according to a specified
pattern. The simple `AD` envelope (A for "attack", D for "decay")
below returns a wave
transformation that linearly increases the amplitude of a
given wave until a time
`t1`, then linearly decreases the amplitude until it
reaches 0 at a time `t2`.
```js
function AD(t1, t2) {
    const a1 = 1 / t1;
    const a2 = 1 / (t1 - t2);
    const b2 = t2 / (t2 - t1);
    return w => t => t > 0 && t < t1
                     ? w(t) * a1 * t
                     : t < t2
                     ? w(t) * (a2 * t + b2)
                     : 0;
}
```
We can turn white noise into an instrument by applying a drum
envelope to it.
```js
const drum = AD(0, 0.005, 0.1)(noise);
const snare_drum = drum(noise);
play_wave(snare_drum, 1);
```
Combining several sine waves with low non-harmonic frequencies
produces a sound reminiscent of a hollow drum.
```js
const pongo_wave_1 = average(average(sine_wave(167), sine_wave(191)),
                             average(sine_wave(207), sine_wave(134)));
play_wave(pongo_wave_1, 1);

const pongo_drum_1 = drum(pongo_wave_1);

// average four sine waves with low prime frequencies
const pongo_wave_2 = average(average(sine_wave(267), sine_wave(291)),
                             average(sine_wave(307), sine_wave(234)));
play_wave(pongo_wave_1, 1);

const pongo_drum_2 = drum(pongo_wave_2);

play_wave(pongo_drum, 1);
```
Now we can combine our drums into a rhythm and play it repeatedly.
```js
const rhythm = sequence(sequence(pongo_drum_1, 0.3, snare_drum), 
                        0.4,
                        sequence(pongo_drum_2, 0.2, pongo_drum_2));
play_wave(rhythm, 1);

const repeated_rhythm = repeat_every(0.8)(rhythm);
play_wave(repeated_rhythm, 4);
```

## Music

A common way of making music follows the so-called
*equal temperament*. A sequence of 12 pitches (frequencies)
are spaced equally between a pitch and the pitch that doubles
its frequency. Traditionally the pitches are labelled
with letters from `a` to `g`, possibly augmented by a *sharp* sign.
```js
// ratio of two neighboring notes in equal temperament
const semitone = math_pow(2, 1/12);

// base frequency A3 has 220 Hertz
const a             = 220;
const a_sharp       = a        * semitone;
const b             = a_sharp  * semitone;
const c             = b        * semitone;
const c_sharp       = c        * semitone;
const d             = c_sharp  * semitone;
const d_sharp       = d        * semitone;
const e             = d_sharp  * semitone;
const f             = e        * semitone;
const f_sharp       = f        * semitone;
const g             = f_sharp  * semitone;
const g_sharp       = g        * semitone;
```
The next so-called *octave* is distinguished with an underscore
before each pitch name.
```
const _a            = g_sharp  * semitone;
const _a_sharp      = _a       * semitone;
const _b            = _a_sharp * semitone;
const _c            = _b       * semitone;
const _c_sharp      = _c       * semitone;
const _d            = _c_sharp * semitone;
const _d_sharp      = _d       * semitone;
// etc
```
A pleasant sound, reminiscent of a pipe organ, is produced
by combining a base frequency
with its first and third overtone. The `organ` function
below produces such a sound using a given base frequency
and a given duration, the latter used to make an envelope.
```js
// organ has base frequency and two overtones at octaves
const organ = f => d => AD(0.1, d)
                            (average(sine_wave(f),
                                 average(sine_wave(f * 2),
                                     sine_wave(f * 4))));
play_wave(organ(c)(2), 2);
```
Here is a little song, played with this "organ", by using
durations denoted by sequences of underscore signs.
```js
// mini-language for playing songs
const $ = sequence;
const _ = 0.3; // duration of quarter note
const __ = 0.6; // duration of half note
const ____ = 1.2; // duration of full note
const happy = $(organ(g)(_),_,
                $(organ(g)(_),_,
                  $(organ(_a)(__),__,
                    $(organ(g)(__),__,
                      $(organ(_c)(__),__,
                        organ(_b)(____))))));
play_wave(happy, 5);                  
```

## A Passing AMTRAK Train

Our final example generates the sound of a passing train,
using what is called the *Doppler effect*. It arises when
a sound source moves, relative to the listener. A passing train
first approaches the listener, and then moves away from it,
which results in a lowering of the sound frequency as perceived
by the listener.
```js
const square = x => x * x;

// doppler makes wave transformer that starts shrinking time 
// at t1 and reaches maximal shrinking factor max at time t2
function doppler(max, t1, t2) {
    const b = square(t2 - t1) - 2 * (t2 - t1) * t2;
    const ts = t => t < t1
                    ? 0
                    : t < t2
                    ? square(t - t1) * max / square(t2 - t1)
                    : (2 * (t2 - t1) * t + b) * max / square(t2 - t1);
    return w => t => w(t + ts(t));
}

play_wave(doppler(-0.1, 1, 2)(sine_wave(1000)), 3);
```
The horn of an American AMTRAK train is uses specific
harmonies.
```js
const amtrak = average(average(average(sine_wave(d_sharp), 
                                       sine_wave(_d_sharp)), 
                               sine_wave(f_sharp)),
                       average(sine_wave(g_sharp), 
                               sine_wave(_b)));

const dampen = (w, f) => t => w(t) / f;

const doppler_amtrak = dampen(doppler(-0.03, 2, 3)(amtrak), 2);

play_wave(dampen(doppler_amtrak, 2), 5);
```
Finally we use different envelopes for the left and right
channel, which means that the listener perceives the train
approaching from the left and leaving to the right.
```js
const left = AD(2, 6);
const right = AD(4, 6);         

play_waves(left(doppler_amtrak), right(doppler_amtrak), 6);
```
To read more about this approach of *functional audio processing*,
take a look at [our paper](https://www.comp.nus.edu.sg/~henz/publications/index.html#splasheteachable2021.abstract).

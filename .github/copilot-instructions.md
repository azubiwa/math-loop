# MathLoop review instructions

This repository implements an AtCoder-like platform for university mathematics.

When reviewing pull requests:

## General
- Prioritize correctness over stylistic preferences.
- Report only actionable issues.
- Distinguish bugs from optional improvements.

## Application correctness
- Check authentication and authorization carefully.
- Check database consistency and race conditions.
- Check whether users can access answers or solutions before they should.
- Check server/client trust boundaries.
- Check input validation.
- Check scoring, submission state, and progress calculations.

## Mathematics
- Treat mathematical correctness as a first-class requirement.
- Check definitions, assumptions, quantifiers, and notation.
- Detect missing hypotheses.
- Check whether stated problems actually have the claimed answer.
- Check mathematical edge cases and counterexamples.
- Check consistency between problem statements, hints, answers, and explanations.
- Never silently change the mathematical meaning to improve wording.

## TeX
- Check malformed LaTeX.
- Check inline/display math usage.
- Check notation consistency.

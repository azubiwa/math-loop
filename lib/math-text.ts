export function normalizeMathDelimiters(text: string, useDisplayStyle = true) {
  const normalizedLimit = text.replace(/lim_\{([^}]+)\}\s*\(([^)]+)\)\/\(([^)]+)\)/g, (_match, limit, numerator, denominator) => {
    const tex = (value: string) => value
      .replace(/→/g, "\\to ")
      .replace(/∞/g, "\\infty")
      .replace(/²/g, "^2")
      .replace(/³/g, "^3")
      .replace(/⁴/g, "^4")
      .replace(/−/g, "-");
    return `$${useDisplayStyle ? "\\displaystyle" : ""}\\lim_{${tex(limit)}}\\frac{${tex(numerator)}}{${tex(denominator)}}$`;
  });
  const normalizedTeX = normalizedLimit.includes("$") ? normalizedLimit : normalizedLimit.replace(/([A-Za-z0-9()[\]{}_^+\-*/=<>|,.\s]*\\[A-Za-z]+[A-Za-z0-9()[\]{}_^+\-*/=<>|,.\s\\]*)/g, (formula) => {
    const trimmed = formula.trim();
    return trimmed ? `$${useDisplayStyle ? "\\displaystyle " : ""}${trimmed}$` : formula;
  });

  if (normalizedTeX.includes("$")) return normalizedTeX;

  return normalizedTeX.replace(/([A-Za-z](?:_[A-Za-z0-9{}+\-]+|\^[A-Za-z0-9{}+\-]+)(?:[A-Za-z0-9_{}^\\\s∩∪∈+=()]+)?)/g, (formula) => {
    const trimmed = formula.trim();
    return trimmed ? `$${useDisplayStyle ? "\\displaystyle " : ""}${trimmed}$` : formula;
  });
}

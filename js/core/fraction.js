// Rationnels exacts : indispensables pour comparer des proportions sans erreur d'arrondi.
export function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const t = a % b; a = b; b = t; }
  return a;
}

export function lcm(a, b) {
  return a && b ? Math.abs(a / gcd(a, b) * b) : 0;
}

export class Frac {
  constructor(n, d = 1) {
    if (d === 0) throw new Error('Division par zéro');
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d) || 1;
    this.n = n / g;
    this.d = d / g;
  }
  add(o) { return this.d === o.d ? new Frac(this.n + o.n, this.d) : new Frac(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { return this.d === o.d ? new Frac(this.n - o.n, this.d) : new Frac(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { return typeof o === 'number' ? new Frac(this.n * o, this.d) : new Frac(this.n * o.n, this.d * o.d); }
  div(o) { return typeof o === 'number' ? new Frac(this.n, this.d * o) : new Frac(this.n * o.d, this.d * o.n); }
  eq(o) { return this.n === o.n && this.d === o.d; }
  isZero() { return this.n === 0; }
  valueOf() { return this.n / this.d; }
  toString() { return this.d === 1 ? String(this.n) : `${this.n}/${this.d}`; }
}

export const ZERO = new Frac(0);
export const ONE = new Frac(1);
export const frac = (n, d = 1) => new Frac(n, d);

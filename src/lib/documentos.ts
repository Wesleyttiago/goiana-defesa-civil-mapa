const digitos = (s: string) => s.replace(/\D/g, '');

export function cpfValido(valor: string): boolean {
  const cpf = digitos(valor);
  if (/[^\d.\-\s]/.test(valor) || cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  for (const tamanho of [9, 10]) {
    const soma = [...cpf.slice(0, tamanho)].reduce((total, n, i) => total + Number(n) * (tamanho + 1 - i), 0);
    const resto = (soma * 10) % 11;
    if (Number(cpf[tamanho]) !== (resto === 10 ? 0 : resto)) return false;
  }
  return true;
}
export function formatarCpf(valor: string): string {
  return digitos(valor).slice(0, 11).replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}

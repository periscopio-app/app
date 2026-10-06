/**
 * Base das chamadas à API. Vazio = mesmo domínio (`/api/...`), repassado pelo
 * rewrite do Next.js para a API. Não use a URL absoluta do Render no navegador:
 * o cookie de sessão não é enviado entre domínios diferentes.
 */
export const apiUrl = "";

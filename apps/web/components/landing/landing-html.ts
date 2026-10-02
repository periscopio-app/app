// Marcação estática da página /piloto
export const LANDING_HTML = `<header>
 <div class="wrap bar">
  <a href="#topo" aria-label="Periscópio, início"><img src="/landing-logo.webp" alt="Periscópio"></a>
  <nav aria-label="Principal">
   <a href="#como">Como funciona</a><a href="#para-quem">Para quem</a><a href="#equipe">Equipe</a><a href="#piloto">Piloto</a><a href="#perguntas">Perguntas</a>
  </nav>
  <a class="btn btn-primary" href="#contato">Candidatar ao piloto</a>
 </div>
</header>

<main id="topo">
<!-- HERO -->
<section class="hero">
 <div class="wrap hero-grid">
  <div>
   <span class="pill"><i></i>Piloto aberto para novos parceiros</span>
   <h1>A escola percebe primeiro. O Periscópio mostra o caminho do cuidado.</h1>
   <p class="lead">Uma plataforma que reúne escola, saúde e assistência social em um só fluxo. O professor registra o que observou, o profissional certo avalia e a história da criança não se perde no meio do caminho.</p>
   <div class="cta-row">
    <a class="btn btn-primary" href="#contato">Candidatar minha instituição ao piloto</a>
    <a class="btn btn-ghost" href="#como">Ver como funciona</a>
   </div>
   <p class="small" style="margin-top:12px">Uma conversa para entender o seu caso. Sem compromisso.</p>
   <div class="seek">
    <strong>Estamos procurando parceiros para o piloto:</strong>
    <div class="chips"><span class="chip">Prefeituras e secretarias</span><span class="chip">Escolas públicas e privadas</span><span class="chip">Instituições sem fins lucrativos</span></div>
   </div>
  </div>

  <aside class="case" aria-label="Exemplo ilustrativo de um caso na plataforma">
   <div class="case-head">
    <div><span class="small">Exemplo ilustrativo</span><br><b>Caso ALU-0427</b></div>
    <span class="tag rev">Com o médico</span>
   </div>
   <ol class="steps">
    <li class="d"><span class="dot" aria-hidden="true">✓</span><div><b>Professor registra o que observou</b><span class="s">Ficha de observação enviada à escola</span></div><span class="tag done">Feito</span></li>
    <li class="d"><span class="dot" aria-hidden="true">✓</span><div><b>Equipe da escola completa e envia</b><span class="s">Depois do envio, só consulta</span></div><span class="tag done">Enviado</span></li>
    <li class="n"><span class="dot" aria-hidden="true"></span><div><b>Médico lê o resumo e escolhe os especialistas</b><span class="s">Decisão sempre do profissional de saúde</span></div><span class="tag rev">Agora</span></li>
    <li><span class="dot" aria-hidden="true"></span><div><b>Especialistas preenchem só a sua parte</b><span class="s">Cada um devolve um resumo ao médico</span></div><span class="tag wait">Depois</span></li>
    <li><span class="dot" aria-hidden="true"></span><div><b>Médico reúne tudo e conversa com a família</b><span class="s">Encaminhamento, acompanhamento ou encerramento</span></div><span class="tag wait">Depois</span></li>
   </ol>
   <p class="case-foot">O aluno aparece por um código, sem nome. Dados fictícios, só para mostrar o fluxo.</p>
  </aside>
 </div>
</section>

<!-- PROBLEMA -->
<section class="problem" id="problema">
 <div class="wrap">
  <div class="sec-head">
   <span class="eyebrow">Por que isso importa</span>
   <h2>O sofrimento começa cedo. O acesso ao cuidado demora a chegar.</h2>
   <p class="lead">Dificuldades para aprender, mudanças de comportamento, choro frequente e medos muito grandes podem ser sinais de que a criança precisa de atenção. A escola costuma ver primeiro. A pergunta é o que acontece depois.</p>
  </div>
  <div class="stats">
   <article class="stat"><span class="big">até metade</span><p>A Organização Mundial da Saúde aponta que até metade dos problemas de saúde mental começa antes dos 14 anos.</p><p class="src">OMS, 2020. Uma revisão de 192 estudos indica cerca de 1 terço antes dos 14 e quase metade antes dos 18 (Solmi e colaboradores, 2022).</p></article>
   <article class="stat"><span class="big">1 em 8</span><p>Estimativas internacionais indicam que cerca de 1 em cada 8 crianças e adolescentes tem algum transtorno mental. No Brasil, estudos regionais variam de cerca de 10% a 20%.</p><p class="src">Polanczyk e colaboradores, 2015 (mundo). Revisão sistemática, BMJ Global Health, 2026 (Brasil).</p></article>
   <article class="stat"><span class="big">19,8%</span><p>Em quatro municípios brasileiros, entre estudantes de 6 a 16 anos com algum transtorno, só 19,8% haviam sido atendidos por serviço de saúde mental no último ano. Cerca de 4 em cada 5 não.</p><p class="src">Paula e colaboradores, PLOS ONE, 2014. Estudo com 1.721 estudantes, não representa o país inteiro.</p></article>
  </div>
  <div class="callout">
   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.01"/></svg>
   <p><b>Perceber sinais não é diagnosticar.</b> O professor observa e registra. Quem avalia é o profissional de saúde.</p>
  </div>
 </div>
</section>

<!-- COMO FUNCIONA -->
<section class="how" id="como">
 <div class="wrap">
  <div class="sec-head">
   <span class="eyebrow">Como funciona</span>
   <h2>Três passos, cada pessoa no seu papel</h2>
   <p class="lead">O Periscópio organiza o caminho que a informação percorre. Ninguém precisa entender de termos médicos para usar.</p>
  </div>
  <div class="flow">
   <article><span class="who">1 · Professor</span><h3>Registra o que viu</h3><p>Em uma ficha simples, com fatos observados em sala: o que aconteceu, quando e com que frequência. Sem rótulos e sem diagnóstico.</p><p class="hand">Sai daqui: a ficha de observação.</p></article>
   <article><span class="who">2 · Escola</span><h3>Chama o profissional certo</h3><p>A equipe da escola completa o registro e envia ao médico responsável. Depois do envio, o registro fica só para consulta e cada mudança fica anotada.</p><p class="hand">Sai daqui: um resumo de uma página.</p></article>
   <article><span class="who">3 · Equipe de saúde</span><h3>Avalia e devolve</h3><p>O médico escolhe quais especialistas chamar. Cada um preenche só a sua parte e devolve ao médico, que reúne tudo e decide os próximos passos com a família.</p><p class="hand">Sai daqui: encaminhamento, acompanhamento ou encerramento do caso.</p></article>
  </div>
  <p class="rule"><span>A decisão final é sempre do médico responsável.</span></p>
 </div>
</section>

<!-- O QUE ORGANIZA -->
<section id="plataforma">
 <div class="wrap">
  <div class="sec-head">
   <span class="eyebrow">O que a plataforma organiza</span>
   <h2>Menos papel perdido, mais tempo para a criança</h2>
  </div>
  <div class="ben">
   <div><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M7 11.5V16c0 1.5 2.2 3 5 3s5-1.5 5-3v-4.5"/></svg><h3>Formação e apoio contínuo</h3><p>Capacitações, materiais para professores e responsáveis e supervisão à distância para as equipes.</p></div>
   <div><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg><h3>Registros no mesmo lugar</h3><p>Observações, encaminhamentos e evolução da criança reunidos, sem fichas soltas e sem repetir a mesma história a cada serviço.</p></div>
   <div><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><path d="M7 12h3M14 12h3"/></svg><h3>Visão de cada etapa</h3><p>Dá para ver onde cada caso está e se alguma etapa parou, para retomar o contato antes que a família se afaste.</p></div>
   <div><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg><h3>Números para a gestão</h3><p>Indicadores para acompanhar o programa e decidir se ele continua, muda ou cresce. Mostram o conjunto, nunca um aluno.</p></div>
  </div>
 </div>
</section>

<!-- PARA QUEM -->
<section class="for" id="para-quem">
 <div class="wrap">
  <div class="sec-head">
   <span class="eyebrow">Para quem é o piloto</span>
   <h2>Procuramos três tipos de parceiro</h2>
   <p class="lead">O piloto serve para testar o Periscópio na prática, junto com quem vai usar, e medir se ele ajuda. Escolha o perfil mais próximo do seu.</p>
  </div>
  <div class="profiles">
   <article class="profile">
    <div class="top"><span class="ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6"/></svg></span>
    <h3>Prefeituras e secretarias</h3>
    <p>Educação, saúde e assistência social trabalhando no mesmo fluxo.</p>
    <ul><li>Um caminho comum para as três áreas</li><li>Indicadores para decidir continuar ou ampliar</li><li>Relatório final do piloto</li></ul></div>
    <a class="btn btn-outline" href="#contato" data-perfil="Governo">Conversar sobre o piloto na minha rede</a>
   </article>
   <article class="profile">
    <div class="top"><span class="ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M7 11.5V16c0 1.5 2.2 3 5 3s5-1.5 5-3v-4.5"/></svg></span>
    <h3>Escolas públicas e privadas</h3>
    <p>Um caminho claro para o que fazer depois que o professor percebe algo.</p>
    <ul><li>Capacitação para a equipe</li><li>Registro simples, no ritmo da sala de aula</li><li>Apoio da equipe de saúde</li></ul></div>
    <a class="btn btn-outline" href="#contato" data-perfil="Escola">Candidatar minha escola</a>
   </article>
   <article class="profile">
    <div class="top"><span class="ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-4.5-9-9.5C1.7 7.8 4 5 7 5c2 0 3.5 1 5 3 1.5-2 3-3 5-3 3 0 5.3 2.8 4 6.5-2 5-9 9.5-9 9.5z"/></svg></span>
    <h3>Instituições sem fins lucrativos</h3>
    <p>Associações, ONGs, fundações e serviços de saúde ou assistência que atendem crianças.</p>
    <ul><li>Organização do trabalho com escolas parceiras</li><li>Registro do percurso de cada criança</li><li>Dados para prestar contas do trabalho</li></ul></div>
    <a class="btn btn-outline" href="#contato" data-perfil="ONG">Candidatar minha instituição</a>
   </article>
  </div>
 </div>
</section>

<!-- EXPERIÊNCIA -->
<section class="exp" id="experiencia">
 <div class="wrap exp-grid">
  <div class="sec-head" style="margin:0">
   <span class="eyebrow">De onde vem o método</span>
   <h2>Quase duas décadas de trabalho antes da plataforma</h2>
   <p class="lead">O Periscópio não nasceu como software. Nasceu em um município, com escolas, equipe de saúde e assistência social trabalhando juntas. A plataforma leva esse método para o dia a dia de outras redes.</p>
   <div class="coord"><b>Coordenação</b><span>Dra. Ana Cecília Petta Roselli Marques, psiquiatra, doutora em Neurociências pela UNIFESP (CRM 50432). Coordena o programa desde o início.</span></div>
  </div>
  <ol class="timeline">
   <li><span class="y">2007</span><p><b>Começa em Tarumã.</b> O município, escolhido por sorteio, reúne gestores, forma núcleos por área, levanta as necessidades locais e capacita as equipes.</p></li>
   <li><span class="y">2007–2025</span><p><b>Escola, saúde e assistência juntas.</b> O programa Saúde Mental na Escola une observação na escola, atendimento especializado no núcleo assistencial, orientação às famílias e acompanhamento pela rede.</p></li>
   <li><span class="y">2015–2025</span><p><b>531 crianças</b> receberam tratamento especializado, segundo o registro institucional do Periscópio. Esses são resultados do que foi vivido em Tarumã e não garantem o mesmo resultado em outros lugares.</p></li>
   <li><span class="y">Hoje</span><p><b>Um guia prático para as escolas</b> reúne protocolos de avaliação, manejo escolar, orientação às famílias e encaminhamentos. A plataforma digital leva esse método para o dia a dia das redes parceiras.</p></li>
  </ol>
 </div>
</section>

__EQUIPE__
<!-- PRIVACIDADE -->
<section class="priv" id="privacidade">
 <div class="wrap">
  <div class="sec-head">
   <span class="eyebrow">Privacidade e limites</span>
   <h2>Cuidado com os dados e clareza sobre o que a plataforma não faz</h2>
   <p class="lead">Estamos falando de crianças. Por isso cada pessoa vê só o que precisa e as decisões de saúde ficam com quem tem formação para tomá-las.</p>
  </div>
  <div class="two">
   <div class="box yes"><h3>O Periscópio faz</h3><ul>
    <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Organiza observações, documentos e encaminhamentos entre escola e equipe de saúde.</li>
    <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Mostra cada aluno por um código, sem nome.</li>
    <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Separa o acesso por função: cada pessoa vê só a parte que cabe ao seu papel.</li>
    <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Anota quem fez cada envio e cada mudança, e quando.</li>
    <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Foi pensado de acordo com os princípios da LGPD para dados de crianças: melhor interesse da criança, linguagem simples e consentimento da família.</li>
   </ul></div>
   <div class="box no"><h3>O Periscópio não faz</h3><ul>
    <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>Não dá diagnóstico.</li>
    <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>Não indica remédio nem tratamento.</li>
    <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>Não decide sozinho quando o caso termina. Isso é do médico responsável.</li>
    <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>Não substitui profissionais de saúde nem a equipe da escola.</li>
   </ul></div>
  </div>
  <div class="table-wrap">
   <table>
    <thead><tr><th scope="col">Quem</th><th scope="col">O que faz na plataforma</th><th scope="col">O que vê</th></tr></thead>
    <tbody>
     <tr><td>Professor</td><td>Faz o primeiro registro e encaminha à escola</td><td>Só o que a escola autorizar</td></tr>
     <tr><td>Equipe da escola</td><td>Completa o registro e envia ao médico</td><td>O próprio registro e o resumo autorizado</td></tr>
     <tr><td>Médico</td><td>Escolhe os especialistas e decide os próximos passos</td><td>O caso completo</td></tr>
     <tr><td>Especialista</td><td>Preenche só a sua parte e devolve ao médico</td><td>A ficha da escola e o resumo aprovado</td></tr>
     <tr><td>Gestão</td><td>Acompanha o programa</td><td>Só números do conjunto, nunca um aluno</td></tr>
    </tbody>
   </table>
  </div>
  <p class="small" style="margin-top:14px;max-width:80ch">A base legal e o consentimento das famílias são definidos junto com a sua rede, no plano de implantação.</p>
 </div>
</section>

<!-- PILOTO -->
<section class="pilot" id="piloto">
 <div class="wrap">
  <div class="sec-head">
   <span class="eyebrow">O piloto</span>
   <h2>Testamos juntos, medimos e decidimos juntos</h2>
   <p class="lead">No piloto, o Periscópio é usado em uma rede ou instituição parceira durante o ano letivo. A jornada principal já pode ser vista em demonstração; o piloto serve para validar o uso real com você. No fim, um relatório mostra o que funcionou e o que precisa mudar.</p>
  </div>
  <div class="terms">
   <div class="term hl"><h3>O que oferecemos</h3><ul><li>A plataforma, com a configuração do ambiente e o cadastro das equipes</li><li>Capacitação para usar a ferramenta</li><li>Suporte técnico durante o piloto</li><li>Licença da plataforma sem cobrança durante o piloto, prevista no plano e formalizada em contrato</li></ul></div>
   <div class="term"><h3>O que pedimos</h3><ul><li>Uma pessoa de contato na sua instituição</li><li>Equipes dispostas a testar na prática</li><li>Reuniões de acompanhamento e retorno sobre o uso</li></ul></div>
   <div class="term"><h3>Como começa</h3><p>Uma conversa para entender o seu caso. Depois, combinamos em conjunto as responsabilidades, a equipe, a estrutura, a capacidade de atendimento e o cronograma, e registramos tudo no plano de implantação.</p><p class="small">O formato do acordo depende das regras do seu órgão ou da sua organização. Conversamos sobre as opções.</p></div>
   <div class="term"><h3>E depois do piloto</h3><p>O modelo previsto tem uma taxa única de implantação e uma licença anual por escola, que cobre hospedagem segura, proteção de dados, suporte, atualizações e relatórios para a gestão. Os valores são apresentados no plano, conforme o número de escolas e de alunos.</p></div>
  </div>
  <div class="ind">
   <div><h3>Cinco indicadores para avaliar o piloto</h3><p class="small" style="margin-top:6px">Os critérios de cálculo são definidos com você, no planejamento.</p></div>
   <ol>
    <li><b>Formação</b><span>Quantos educadores concluíram a capacitação.</span></li>
    <li><b>Observações</b><span>Quantos alunos tiveram sinais de dificuldade registrados pela escola.</span></li>
    <li><b>Chegada ao núcleo</b><span>Quantas crianças chegaram à primeira avaliação.</span></li>
    <li><b>Continuidade</b><span>Quantas famílias seguiram no acompanhamento, quantas pararam e quantas receberam alta.</span></li>
    <li><b>Evolução</b><span>Comparação entre a avaliação do começo e a do fim do ano letivo.</span></li>
   </ol>
   <p class="small">O relatório final apoia a decisão conjunta de continuar, ampliar ou mudar o programa. Os indicadores medem o funcionamento do piloto e não prometem resultado para a criança.</p>
  </div>
 </div>
</section>

<!-- FAQ -->
<section class="faq" id="perguntas">
 <div class="wrap">
  <div class="sec-head"><span class="eyebrow">Perguntas frequentes</span><h2>O que costumam nos perguntar</h2></div>
  <div class="faq-list">
   <details><summary>O Periscópio faz diagnóstico?</summary><p>Não. O Periscópio organiza informações, documentos e encaminhamentos entre escola e equipe de saúde. A avaliação e as decisões são sempre de profissionais de saúde habilitados.</p></details>
   <details><summary>Preciso entender de saúde para usar?</summary><p>Não. O professor registra o que observou em sala, em linguagem do dia a dia: o que aconteceu, quando e com que frequência. Termos médicos ficam com a equipe de saúde.</p></details>
   <details><summary>Quem vê as informações de cada criança?</summary><p>Só quem precisa, conforme o seu papel. O especialista, por exemplo, vê a ficha da escola e a sua própria parte. A gestão vê apenas números do conjunto, nunca um aluno. Cada aluno aparece por um código, sem nome.</p></details>
   <details><summary>O piloto tem custo?</summary><p>Durante o piloto, está prevista a licença sem cobrança, que será formalizada em contrato. Depois, o modelo previsto tem uma taxa única de implantação e uma licença anual por escola. Os valores são apresentados no plano, conforme o número de escolas e de alunos.</p></details>
   <details><summary>Precisa de licitação ou contrato?</summary><p>Depende do seu órgão ou da sua organização. Na conversa, mapeamos as opções de formato com você e com a sua área jurídica.</p></details>
   <details><summary>A minha instituição é pequena. Posso me candidatar?</summary><p>Pode. Na conversa, entendemos o tamanho da sua rede ou da sua instituição e desenhamos o piloto a partir dele.</p></details>
   <details><summary>E o consentimento das famílias?</summary><p>A base legal e o consentimento são definidos junto com a sua rede, no plano de implantação, seguindo os princípios da LGPD para dados de crianças.</p></details>
  </div>
 </div>
</section>

<!-- CONTATO -->
<section class="contact" id="contato">
 <div class="wrap contact-grid">
  <div>
   <span class="eyebrow">Candidatura ao piloto</span>
   <h2>Vamos conversar sobre levar o Periscópio para a sua rede?</h2>
   <p class="lead" style="margin-top:14px">Conte quem é a sua instituição e o que você quer resolver. A equipe do Periscópio responde para marcar uma conversa.</p>
   <ul>
    <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Prefeituras, escolas e instituições sem fins lucrativos</li>
    <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Sem compromisso nesta primeira conversa</li>
    <li><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Prefere WhatsApp? +55 11 98444-4994</li>
   </ul>
  </div>
  <form id="form" novalidate>
   <div class="f2">
    <div class="field"><label for="nome">Seu nome</label><input id="nome" name="nome" autocomplete="name" required></div>
    <div class="field"><label for="email">E-mail</label><input id="email" name="email" type="email" autocomplete="email" placeholder="nome@instituicao.org.br" required></div>
   </div>
   <div class="f2">
    <div class="field"><label for="org">Instituição</label><input id="org" name="org" autocomplete="organization" required></div>
    <div class="field"><label for="tipo">Tipo de instituição</label>
     <select id="tipo" name="tipo"><option value="">Escolha uma opção</option><option value="Governo">Prefeitura ou secretaria</option><option value="Escola">Escola pública ou privada</option><option value="ONG">Instituição sem fins lucrativos</option><option value="Outro">Outro</option></select></div>
   </div>
   <div class="field"><label for="msg">O que você quer resolver? (opcional)</label><textarea id="msg" name="msg" placeholder="Ex.: queremos um caminho claro entre as escolas e a rede de saúde do município."></textarea></div>
   <button class="btn btn-primary" type="submit">Enviar candidatura</button>
   <p class="consent">Usamos estes dados só para responder ao seu contato, de acordo com os princípios da LGPD. Não pedimos nem recebemos informações de alunos neste formulário.</p>
   <p class="ok" id="ok" role="status">Protótipo: no site publicado, este botão envia o seu pedido para a equipe do Periscópio.</p>
  </form>
 </div>
</section>
</main>

<footer>
 <div class="wrap foot">
  <div class="brand"><img src="/landing-logo.webp" alt="Periscópio"><span class="small">Programa Periscópio Saúde Mental na Escola</span></div>
  <p class="legal">O Periscópio organiza informações, documentos e encaminhamentos entre escola e equipe de saúde. A decisão é sempre de um profissional de saúde. Não realiza diagnóstico, não prescreve e não substitui profissionais habilitados. As estimativas citadas vêm das fontes indicadas em cada número e podem variar conforme o estudo e a região.</p>
 </div>
</footer>

<button class="theme" id="theme" type="button" aria-label="Alternar tema claro e escuro">
 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>
</button>

`;

/* ==========================================================================
   HelixGen: cabeçalho, menu, rodapé e aviso de cookies
   Ficam só neste arquivo e entram em todas as páginas. Para mudar um item do
   menu ou do rodapé, edite as listas NAV e RODAPE abaixo.
   ========================================================================== */
(() => {
  const NAV = [
    ['Exames', 'exames.html'],
    ['Para clínicas', 'para-clinicas.html'],
    ['Sobre', 'sobre.html'],
    ['Blog', 'blog.html'],
    ['Contato', 'contato.html']
  ];
  const RODAPE = [...NAV.slice(0, 4), ['Resultados', 'resultados.html']];
  const here = (location.pathname.split('/').pop() || 'index.html');
  const cur = href => (here === href || (href === 'exames.html' && here.startsWith('exame-')) || (href === 'blog.html' && here.startsWith('blog-'))) ? ' aria-current="page"' : '';
  const links = (list, cls) => list.map(([t, h]) => `<a class="${cls}" href="${h}"${cur(h)}>${t}</a>`).join('');

  document.body.insertAdjacentHTML('afterbegin', `
<a class="skip" href="#conteudo">Pular para o conteúdo</a>
<header class="header" data-theme="dark">
  <div class="header__in">
    <a class="header__logo" href="index.html" aria-label="HelixGen Laboratório, início">
      <img class="logo logo--branco" src="assets/img/logo-helixgen-branco.png" width="843" height="192" alt="">
      <img class="logo logo--cor" src="assets/img/logo-helixgen.png" width="843" height="196" alt="">
    </a>
    <nav class="header__nav" aria-label="Principal">${links(NAV, 'navlink')}</nav>
    <div class="header__actions">
      <a class="btn btn--ghost btn--sm" href="resultados.html">Acessar resultado</a>
      <button class="burger" type="button" aria-expanded="false" aria-controls="menu" aria-label="Abrir menu"><span></span><span></span></button>
    </div>
  </div>
</header>
<div class="menu" id="menu" aria-hidden="true">
  <nav class="menu__nav" aria-label="Menu">${links(NAV, '')}</nav>
  <div class="menu__foot">
    <a class="btn btn--light" href="resultados.html">Acessar resultado</a>
    <a class="menu__tel" data-tel href="tel:+553131663505">(31) 3166-3505</a>
  </div>
</div>`);

  document.body.insertAdjacentHTML('beforeend', `
<footer class="footer" data-theme="dark">
  <div class="wrap footer__grid">
    <div class="footer__brand">
      <img src="assets/img/logo-helixgen-branco.png" width="843" height="192" alt="HelixGen Laboratório" loading="lazy">
      <p>Precisão que começa no DNA.</p>
    </div>
    <nav aria-label="Rodapé">${links(RODAPE, 'link')}</nav>
    <div class="footer__col">
      <a class="link" data-tel href="tel:+553131663505">(31) 3166-3505</a>
      <a class="link" data-wa href="https://wa.me/553131663505">WhatsApp</a>
      <a class="link" data-mail href="mailto:contato@helixgen.com.br">contato@helixgen.com.br</a>
      <a class="link" data-linkedin href="https://www.linkedin.com/company/helixgen" rel="noopener">LinkedIn</a>
    </div>
    <div class="footer__col footer__legal">
      <p>Responsável técnico<br><span data-cfg="responsavelTecnico">Mateus Silva Cosso Gomes – CRF-MG 47115</span></p>
      <p><span data-cfg="razaoSocial">LABORATÓRIO HELIXGEN LTDA.</span><br>CNPJ <span data-cfg="cnpj">58.282.234/0001-59</span></p>
    </div>
  </div>
  <div class="wrap footer__base">
    <p>© ${new Date().getFullYear()} HelixGen Laboratório. Todos os direitos reservados.</p>
    <p class="footer__pol">
      <a class="link" href="privacidade.html">Política de Privacidade</a>
      <a class="link" href="cookies.html">Política de Cookies</a>
      <button class="link linkbtn" type="button" data-cookie-open>Preferências de cookies</button>
    </p>
  </div>
</footer>
<div class="cookie" role="dialog" aria-labelledby="cookie-t" hidden>
  <p id="cookie-t" class="cookie__t">Cookies</p>
  <p>Este site usa apenas cookies necessários ao funcionamento. Com a sua permissão, também usaremos cookies de medição de audiência. <a class="link" href="cookies.html">Saiba mais</a></p>
  <div class="cookie__a">
    <button class="btn btn--accent btn--sm" type="button" data-cookie="aceito">Permitir medição</button>
    <button class="btn btn--ghost btn--sm" type="button" data-cookie="recusado">Só os necessários</button>
  </div>
</div>`);
})();

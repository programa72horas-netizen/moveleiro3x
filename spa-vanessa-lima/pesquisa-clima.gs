/**
 * PESQUISA DE CLIMA — SPA VANESSA LIMA
 * Cria o formulário completo, anônimo, na conta Google de quem executar.
 *
 * COMO USAR
 * 1. Abra https://script.google.com  → Novo projeto
 * 2. Apague o conteúdo padrão e cole TODO este arquivo
 * 3. Salve (ícone de disquete)
 * 4. Selecione a função "criarPesquisaClima" e clique em Executar
 * 5. Autorize o acesso na primeira execução
 * 6. Abra "Registro de execução" — os dois links aparecem lá
 *
 * RESULTADO: 39 escalas 0–10 · 15 campos abertos · 12 seções
 */

// ---------------------------------------------------------------- HELPERS

function _secao(form, titulo, descricao) {
  var p = form.addPageBreakItem().setTitle(titulo);
  if (descricao) { p.setHelpText(descricao); }
  return p;
}

function _escala(form, titulo, rotuloBaixo, rotuloAlto) {
  form.addScaleItem()
      .setTitle(titulo)
      .setBounds(0, 10)
      .setLabels(rotuloBaixo || 'Péssimo', rotuloAlto || 'Excelente')
      .setRequired(true);
}

function _aberta(form, titulo, obrigatoria) {
  form.addParagraphTextItem()
      .setTitle(titulo)
      .setRequired(obrigatoria === true);
}

// ---------------------------------------------------------------- PRINCIPAL

function criarPesquisaClima() {

  var form = FormApp.create('Pesquisa de Clima — Spa Vanessa Lima');

  form.setDescription(
    'Esta pesquisa é 100% ANÔNIMA. Não coletamos nome, e-mail ou qualquer dado que identifique quem respondeu.\n\n' +
    'Ninguém da coordenação tem acesso individual às respostas — apenas os resultados consolidados.\n\n' +
    'Responda com sinceridade total. O objetivo é corrigir o que está errado, e não conseguimos corrigir aquilo que não sabemos.\n\n' +
    'Tempo estimado: 8 a 10 minutos.\n\n' +
    'Em cada pergunta: 0 = péssimo / discordo totalmente · 10 = excelente / concordo totalmente'
  );

  // ---------- TRAVAS DE ANONIMATO E COMPORTAMENTO ----------
  var avisos = [];

  // Não coletar e-mail (API nova com fallback para a antiga)
  try {
    form.setEmailCollectionType(FormApp.EmailCollectionType.DO_NOT_COLLECT);
  } catch (e1) {
    try { form.setCollectEmail(false); }
    catch (e2) { avisos.push('ATENÇÃO: verifique manualmente se a coleta de e-mail está DESATIVADA.'); }
  }

  // Não exigir login Google (só se aplica a contas Workspace)
  try { form.setRequireLogin(false); }
  catch (e) { avisos.push('setRequireLogin ignorado (conta pessoal — login já não é exigido por padrão).'); }

  try { form.setLimitOneResponsePerUser(false); }
  catch (e) { avisos.push('Verifique manualmente: "Limitar a 1 resposta" deve estar DESLIGADO.'); }

  form.setAllowResponseEdits(false);      // não permite editar após envio
  form.setProgressBar(true);              // barra de progresso
  form.setShowLinkToRespondAgain(false);  // sem "enviar outra resposta"
  form.setPublishingSummary(false);       // não mostra resumo de respostas

  form.setConfirmationMessage(
    'Resposta registrada. Obrigado pela sinceridade. Os resultados consolidados serão ' +
    'apresentados à equipe, junto com o plano de ação do que será corrigido.'
  );

  // ---------- SEÇÃO 1 — RECOMENDAÇÃO ----------
  _secao(form, 'Recomendação');
  _escala(form,
    'Em uma escala de 0 a 10, o quanto você recomendaria o Spa Vanessa Lima como lugar para trabalhar, para uma amiga da área?',
    'Não recomendaria', 'Recomendaria com certeza');
  _aberta(form, 'Por que você deu essa nota?', true);

  // ---------- SEÇÃO 2 — REMUNERAÇÃO ----------
  _secao(form, 'Remuneração e reconhecimento financeiro');
  _escala(form, 'Como você avalia sua remuneração total (salário + comissão) em relação ao trabalho que você entrega?');
  _escala(form, 'O quanto você entende com clareza como sua comissão é calculada?');
  _escala(form, 'O pagamento acontece sempre na data combinada e com o valor correto?');
  _aberta(form, 'Explique suas notas sobre remuneração. O que funciona bem e o que precisa mudar?', true);

  // ---------- SEÇÃO 3 — CLIMA E RELACIONAMENTO ----------
  _secao(form, 'Clima e relacionamento na equipe');
  _escala(form, 'Como você avalia o clima e o respeito entre as profissionais no dia a dia?');
  _escala(form, 'Quando você precisa de ajuda durante o atendimento, você recebe apoio das colegas?');
  _escala(form, 'Você se sente à vontade para relatar um problema à coordenação sabendo que terá retorno e não será exposta?');
  _escala(form, 'As correções e feedbacks são feitos em particular, de forma respeitosa?');
  _aberta(form, 'Explique suas notas sobre o clima da equipe.', true);

  // ---------- SEÇÃO 4 — AGENDA ----------
  _secao(form, 'Organização da agenda');
  _escala(form, 'Como você avalia a organização da sua agenda de atendimentos?');
  _escala(form, 'Os intervalos entre atendimentos são suficientes para higienizar a sala e se preparar?');
  _escala(form, 'Você é avisada com antecedência sobre encaixes, remarcações e cancelamentos?');
  _escala(form, 'A agenda respeita o tempo real que cada procedimento exige para ser bem feito?');
  _aberta(form, 'Explique suas notas sobre a agenda. Se houver um horário ou dia específico que sempre dá problema, cite.', true);

  // ---------- SEÇÃO 5 — CLIENTES NOVAS ----------
  _secao(form, 'Clientes novas vindas das vendas');
  _escala(form, 'As clientes novas chegam entendendo corretamente o que foi contratado?');
  _escala(form, 'A expectativa criada na venda corresponde ao que é possível entregar na sala?');
  _escala(form, 'Você recebe as informações necessárias sobre a cliente antes do atendimento (avaliação, protocolo, restrições)?');
  _escala(form, 'O volume de clientes novas que chega até você é adequado?', 'Muito baixo', 'Ideal');
  _aberta(form, 'Já aconteceu de a cliente chegar esperando algo diferente do que foi vendido? Explique suas notas.', true);

  // ---------- SEÇÃO 6 — EQUIPAMENTOS ----------
  _secao(form, 'Equipamentos de trabalho');
  _escala(form, 'Como você avalia as condições dos equipamentos (radiofrequência, manta térmica, ondas de choque, criolipólise, vacuoterapia, endermologia)?');
  _escala(form, 'Os equipamentos estão disponíveis e funcionando quando você precisa?');
  _escala(form, 'Quando um equipamento apresenta defeito, o conserto acontece em tempo aceitável?');
  _escala(form, 'Você se sente tecnicamente segura e bem treinada para operar todos os equipamentos que utiliza?');
  _aberta(form, 'Explique suas notas sobre equipamentos. Cite qual equipamento, se for o caso.', true);

  // ---------- SEÇÃO 7 — INSUMOS (bloco separado de equipamentos) ----------
  _secao(form, 'Insumos e materiais de trabalho');
  _escala(form, 'Os insumos necessários (cremes, óleos, gel condutor) estão sempre disponíveis quando você vai atender?');
  _escala(form, 'O enxoval limpo (toalhas, lençóis, roupões) é suficiente para todos os atendimentos do dia?');
  _escala(form, 'A qualidade dos produtos utilizados atende ao padrão que você considera profissional?');
  _escala(form, 'Quando você comunica que um item está acabando, a reposição acontece a tempo?');
  _aberta(form, 'Se você já precisou improvisar ou deixar de fazer algo por falta de material, descreva.', true);

  // ---------- SEÇÃO 8 — ESTRUTURA E HIGIENE ----------
  _secao(form, 'Estrutura física e higiene');
  _escala(form, 'Como você avalia a estrutura física do spa (salas, macas, iluminação, climatização, ruído)?');
  _escala(form, 'Como você avalia a limpeza e a higiene dos banheiros ao longo do dia?');
  _escala(form, 'Você tem um espaço adequado para pausa, refeição e guardar seus pertences?');
  _escala(form, 'Você sente que a estrutura permite entregar à cliente o padrão de qualidade que você acredita ser o certo?');
  _aberta(form, 'Explique suas notas sobre estrutura e higiene.', true);

  // ---------- SEÇÃO 9 — GESTÃO E LIDERANÇA ----------
  _secao(form, 'Gestão e liderança');
  _escala(form, 'Você recebe retorno quando relata um problema à coordenação?');
  _escala(form, 'As decisões e mudanças são comunicadas de forma clara e antecipada?');
  _escala(form, 'Você sente que seu trabalho é reconhecido?');
  _escala(form, 'As regras e cobranças são aplicadas de forma justa e igual para todas?');
  _aberta(form, 'Explique suas notas sobre gestão e liderança.', true);

  // ---------- SEÇÃO 10 — CARGA DE TRABALHO E BEM-ESTAR ----------
  _secao(form, 'Carga de trabalho e bem-estar',
    'Este bloco também atende à avaliação de riscos psicossociais exigida pela NR-1.');
  _escala(form, 'Sua carga de trabalho diária é adequada e sustentável?');
  _escala(form, 'Você consegue fazer suas pausas e seu intervalo de almoço na prática?');
  _escala(form, 'Você termina o dia de trabalho com energia física e emocional preservada?');
  _escala(form, 'Você consegue desconectar do trabalho fora do horário (sem cobranças por mensagem)?');
  _aberta(form, 'Explique suas notas sobre carga de trabalho e bem-estar.', true);

  // ---------- SEÇÃO 11 — TREINAMENTO E CRESCIMENTO ----------
  _secao(form, 'Treinamento e crescimento');
  _escala(form, 'Você recebe treinamento técnico suficiente para os protocolos que executa?');
  _escala(form, 'Você enxerga possibilidade de crescer profissionalmente dentro do spa?');
  _aberta(form, 'Que treinamento faria mais diferença no seu trabalho hoje?', false);

  // ---------- SEÇÃO 12 — PARA FECHAR ----------
  _secao(form, 'Para fechar');
  _escala(form, 'Qual a chance de você ainda estar trabalhando no Spa Vanessa Lima daqui a 12 meses?',
    'Nenhuma chance', 'Certeza absoluta');
  _aberta(form, 'Se você pudesse mudar UMA única coisa no spa a partir de amanhã, qual seria?', true);
  _aberta(form, 'O que hoje te faria pensar em sair do spa?', false);
  _aberta(form, 'O que está funcionando bem e NÃO deve ser mudado?', false);
  _aberta(form, 'Espaço livre: algo que você gostaria de dizer e não foi perguntado', false);

  // ---------- PUBLICAÇÃO E CONFERÊNCIA ----------
  try { form.setPublished(true); } catch (e) { /* API antiga: já publicado */ }

  var itens = form.getItems();
  var escalas = 0, abertas = 0, secoes = 0;
  for (var i = 0; i < itens.length; i++) {
    var t = itens[i].getType();
    if (t === FormApp.ItemType.SCALE) { escalas++; }
    if (t === FormApp.ItemType.PARAGRAPH_TEXT) { abertas++; }
    if (t === FormApp.ItemType.PAGE_BREAK) { secoes++; }
  }

  var urlPublico = form.getPublishedUrl();
  var urlCurto = form.shortenFormUrl(urlPublico);

  Logger.log('===============================================');
  Logger.log('FORMULÁRIO CRIADO COM SUCESSO');
  Logger.log('===============================================');
  Logger.log('LINK PARA A EQUIPE (curto): ' + urlCurto);
  Logger.log('LINK PARA A EQUIPE (longo): ' + urlPublico);
  Logger.log('LINK DE EDIÇÃO: ' + form.getEditUrl());
  Logger.log('-----------------------------------------------');
  Logger.log('Escalas 0–10 criadas: ' + escalas + '  (esperado: 39)');
  Logger.log('Campos abertos criados: ' + abertas + '  (esperado: 15)');
  Logger.log('Seções criadas: ' + secoes + '  (esperado: 12)');
  Logger.log('-----------------------------------------------');
  Logger.log('Coleta de e-mail: DESATIVADA');
  Logger.log('Login Google exigido: NÃO');
  Logger.log('Limite de 1 resposta por pessoa: NÃO');
  Logger.log('Edição após envio: NÃO');
  Logger.log('Barra de progresso: SIM');
  Logger.log('Enviar outra resposta: NÃO');
  Logger.log('Perguntas demográficas: NENHUMA');
  if (avisos.length) {
    Logger.log('-----------------------------------------------');
    for (var j = 0; j < avisos.length; j++) { Logger.log(avisos[j]); }
  }
  Logger.log('===============================================');
}

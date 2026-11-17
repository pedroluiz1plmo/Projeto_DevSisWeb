import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleSupportRoute } from '../src/modules/support/support.routes.js';

describe('chamados de suporte', () => {
  const request = (method = 'POST', url = '/api/support/tickets') => ({
    method,
    url,
    headers: {},
  });

  it('valida os campos obrigatórios e rejeita assunto com quebra de linha', async () => {
    const emptyResult = await handleSupportRoute(request(), {});
    assert.equal(emptyResult.status, 400);
    assert.equal(emptyResult.body.success, false);

    const invalidSubjectResult = await handleSupportRoute(request(), {
      name: 'Pessoa',
      email: 'pessoa@example.com',
      category: 'Problema técnico',
      subject: 'Assunto\nBcc: outra-pessoa@example.com',
      description: 'O site não carregou.',
    });
    assert.equal(invalidSubjectResult.status, 400);
  });

  it('envia os dados validados ao serviço de e-mail', async () => {
    let sentTicket;
    const result = await handleSupportRoute({
      ...request(),
      socket: { remoteAddress: 'support-ticket-success-test' },
    }, {
      name: '  Pessoa  ',
      email: ' pessoa@example.com ',
      category: 'Problema técnico',
      subject: 'Erro ao salvar',
      description: 'O formulário não salvou os dados.',
    }, {
      isEmailConfigured: () => true,
      sendEmail: async ticket => { sentTicket = ticket; },
    });

    assert.deepEqual(result, {
      status: 200,
      body: { success: true, message: 'Chamado enviado com sucesso.' },
    });
    assert.deepEqual(sentTicket, {
      name: 'Pessoa',
      email: 'pessoa@example.com',
      category: 'Problema técnico',
      subject: 'Erro ao salvar',
      description: 'O formulário não salvou os dados.',
    });
  });

  it('ignora rotas e métodos que não correspondem ao envio de chamado', async () => {
    assert.equal(await handleSupportRoute(request('GET')), null);
    assert.equal(await handleSupportRoute(request('POST', '/api/support')), null);
  });
});

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
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = await handleSupportRoute({
      ...request(),
      socket: { remoteAddress: 'support-ticket-success-test' },
    }, {
      name: '  Pessoa  ',
      email: ' pessoa@example.com ',
      category: 'Problema técnico',
      subject: 'Erro ao salvar',
      description: 'O formulário não salvou os dados.',
      attachments: [{
        name: '../../captura de tela.png',
        mimeType: 'image/png',
        content: png.toString('base64'),
      }],
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
      attachments: [{
        filename: 'captura_de_tela.png',
        contentType: 'image/png',
        content: png,
      }],
    });
  });

  it('rejeita tipo MIME falso, assinatura inválida e arquivos acima do limite', async () => {
    const validFields = {
      name: 'Pessoa',
      email: 'pessoa@example.com',
      category: 'Problema técnico',
      subject: 'Erro',
      description: 'Descrição do erro.',
    };
    const invalidMime = await handleSupportRoute(request(), {
      ...validFields,
      attachments: [{ name: 'arquivo.png', mimeType: 'image/png', content: Buffer.from('not an image').toString('base64') }],
    });
    assert.equal(invalidMime.status, 400);

    const invalidSignature = await handleSupportRoute(request(), {
      ...validFields,
      attachments: [{ name: 'arquivo.jpg', mimeType: 'image/jpeg', content: Buffer.from('abc').toString('base64') }],
    });
    assert.equal(invalidSignature.status, 400);

    const oversized = await handleSupportRoute(request(), {
      ...validFields,
      attachments: [{ name: 'arquivo.jpg', mimeType: 'image/jpeg', content: Buffer.alloc(2 * 1024 * 1024 + 1, 0xff).toString('base64') }],
    });
    assert.equal(oversized.status, 400);
  });

  it('ignora rotas e métodos que não correspondem ao envio de chamado', async () => {
    assert.equal(await handleSupportRoute(request('GET')), null);
    assert.equal(await handleSupportRoute(request('POST', '/api/support')), null);
  });
});

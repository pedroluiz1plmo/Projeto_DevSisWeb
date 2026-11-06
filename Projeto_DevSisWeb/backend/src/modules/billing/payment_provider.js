export class PaymentProviderNotConfiguredError extends Error {
  constructor() {
    super('Nenhum provedor de pagamento está configurado.');
    this.name = 'PaymentProviderNotConfiguredError';
    this.code = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
  }
}

export const createCheckoutSession = async () => {
  throw new PaymentProviderNotConfiguredError();
};

export const verifyWebhook = async () => {
  throw new PaymentProviderNotConfiguredError();
};

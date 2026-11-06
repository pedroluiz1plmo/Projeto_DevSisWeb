export const planAccessMock = (query) => {
  if (query.includes('FROM subscriptions s')) return { rowCount: 0, rows: [] };
  if (query.includes("WHERE slug = 'freemium'")) {
    return {
      rowCount: 1,
      rows: [{
        id: 1,
        slug: 'freemium',
        name: 'Mestre Freemium',
        billing_period: 'free',
        benefits: {},
        limits: {},
      }],
    };
  }
  return null;
};

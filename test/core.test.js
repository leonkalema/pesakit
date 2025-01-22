const Pesakit = require('../index');
const axios = require('axios');
const MockAdapter = require('axios-mock-adapter');

describe('Pesakit Core Functionality', () => {
  let mock;
  const merchants = {
    kenya: {
      consumerKey: 'VhP+1Be66qPAslmdtzp8CZFROLJd8cx/',
      consumerSecret: 'ZKfN0HsVVIt+Lug8V04YCX+t5YU=',
      environment: 'production'
    },
    uganda: {
      consumerKey: 'TDpigBOOhs+zAl8cwH2Fl82jJGyD8xev',
      consumerSecret: '1KpqkfsMaihIcOlhnBo/gBZ5smw=',
      environment: 'sandbox'
    },
    tanzania: {
      consumerKey: 'ngW+UEcnDhltUc5fxPfrCD987xMh3Lx8',
      consumerSecret: 'q27RChYs5UkypdcNYKzuUw460Dg=',
      environment: 'sandbox'
    },
    malawi: {
      consumerKey: 'htMsEFfIVHfhqBL9O0ykz8wuedfFyg1s',
      consumerSecret: 'DcwkVNIiyijNWn1fdL/pa4K6khc=',
      environment: 'sandbox'
    },
    rwanda: {
      consumerKey: 'wCGzX1fNzvtI5lMR5M4AxvxBmLpFgZzp',
      consumerSecret: 'uU7R9g2IHn9dkrKDVIfcPppktIo=',
      environment: 'sandbox'
    },
    zambia: {
      consumerKey: 'v988cq7bMB6AjktYo/drFpe6k2r/y7z3',
      consumerSecret: '3p0F/KcY8WAi36LntpPf/Ss0MhQ=',
      environment: 'sandbox'
    },
    zimbabwe: {
      consumerKey: 'vknEWEEFeygxAX+C9TPOhvkbkPsj8qXK',
      consumerSecret: 'MOOP31smKijvusQbNXn/s7m8jC8=',
      environment: 'sandbox'
    }
  };

  beforeAll(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.reset();
  });

  test('should get OAuth token', async () => {
    const client = new Pesakit(merchants.kenya);
    mock.onPost('https://pay.pesapal.com/v3/api/auth/request-token')
      .reply(200, { token: 'test_token' });

    const token = await client.getOAuthToken();
    expect(token).toBe('test_token');
  });

    test('should create payment request', async () => {
      const client = new Pesakit(merchants.kenya);
      mock.onPost('https://pay.pesapal.com/v3/api/auth/request-token')
        .reply(200, { token: 'test_token' });
      mock.onPost('https://pay.pesapal.com/v3/api/urlsetup/register-ipn')
        .reply(200, { ipn_id: '123' });
      mock.onPost('https://pay.pesapal.com/v3/api/payments/submit-order')
        .reply(200, { redirect_url: 'https://payment.link' });

    const paymentUrl = await client.createPayment({
      amount: 1000,
      description: 'Test',
      reference: 'TEST-123',
      email: 'test@example.com',
      callbackUrl: 'http://localhost/callback'
    });

    expect(paymentUrl).toBe('https://payment.link');
  });

  test('should verify payment status', async () => {
    const client = new Pesakit(merchants.kenya);
    mock.onPost('https://pay.pesapal.com/v3/api/auth/request-token')
      .reply(200, { token: 'test_token' });
    mock.onGet('https://pay.pesapal.com/v3/api/transactions/get-transaction-status')
      .reply(200, {
        payment_status: 'COMPLETED',
        payment_method: 'M-PESA',
        amount: 1000,
        currency: 'KES'
      });

    const status = await client.verifyPayment('ORDER-123');
    expect(status.status).toBe('COMPLETED');
    expect(status.method).toBe('M-PESA');
  });

  test('should validate IPN signature', async () => {
    const client = new Pesakit(merchants.kenya);
    const ipnHandler = client.createIpnHandler();
    
    const mockReq = {
      headers: {
        'x-pesapal-signature': 'invalid_signature'
      },
      body: {
        orderTrackingId: 'ORDER-123',
        status: 'COMPLETED'
      }
    };
    
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn()
    };

    await ipnHandler(mockReq, mockRes, jest.fn());
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });
});

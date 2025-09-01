import sgMail from '@sendgrid/mail';
import { logger, LogCategory } from './logger';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

interface ContactEmailParams {
  name: string;
  email: string;
  company?: string;
  inquiry: string;
}

export async function sendContactEmail(params: ContactEmailParams): Promise<boolean> {
  try {
    const msg = {
      to: 'remy@delightdesk.com',
      from: 'hello@humanfoodbar.com', // Must be verified in SendGrid
      subject: `New Contact Form Submission from ${params.name}`,
      text: `New Contact Form Submission

Name: ${params.name}
Email: ${params.email}
Company: ${params.company || 'Not provided'}

Inquiry:
${params.inquiry}

---
This message was sent from the Delight Desk contact form.`,
      html: `<p><strong>New Contact Form Submission</strong></p>
      <p><strong>Name:</strong> ${params.name}</p>
      <p><strong>Email:</strong> ${params.email}</p>
      <p><strong>Company:</strong> ${params.company || 'Not provided'}</p>
      <p><strong>Inquiry:</strong></p>
      <p>${params.inquiry.replace(/\n/g, '<br>')}</p>
      <hr>
      <p><em>This message was sent from the Delight Desk contact form.</em></p>`,
      replyTo: params.email,
    };

    const response = await sgMail.send(msg);

    logger.info(LogCategory.EMAIL, 'Contact form email sent successfully', {
      from: params.email,
      name: params.name,
      company: params.company,
      statusCode: response[0].statusCode,
      messageId: response[0].headers['x-message-id']
    });

    console.log('SendGrid Success:', {
      statusCode: response[0].statusCode,
      messageId: response[0].headers['x-message-id']
    });

    return true;
  } catch (error: any) {
    logger.error(LogCategory.EMAIL, 'Failed to send contact form email', {
      error: error.message,
      errorCode: error.code,
      responseBody: error.response?.body,
      from: params.email,
      name: params.name
    });
    
    console.error('SendGrid Error:', error);
    if (error.response) {
      console.error('SendGrid Response Body:', error.response.body);
    }
    
    return false;
  }
}
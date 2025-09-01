interface SignatureData {
  name?: string;
  title?: string;
  company?: string;
  companyUrl?: string;
  phone?: string;
  email?: string;
  photoUrl?: string;
}

export function generateHtmlSignature(data: SignatureData): string {
  const {
    name = '',
    title = '',
    company = '',
    companyUrl = '',
    phone = '',
    email = '',
    photoUrl = ''
  } = data;

  // If no data provided, return empty string
  if (!name && !title && !company && !phone && !email) {
    return 'No signature configured';
  }

  const hasCompanyUrl = companyUrl && companyUrl.startsWith('http');
  const hasContactInfo = email || phone;

  // Clean, professional email signature with optional circular profile image
  return `
<table cellpadding="0" cellspacing="0" border="0" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif; font-size: 14px; line-height: 1.5; color: #333333; border-collapse: collapse; max-width: 500px;">
  <tr>
    ${photoUrl ? `
    <td valign="top" style="padding-right: 16px; width: 60px;">
      <img src="${photoUrl}" alt="${name || 'Profile'}" style="width: 60px; height: 60px; border-radius: 50%; display: block; object-fit: cover; border: 2px solid #f0f0f0;" />
    </td>
    ` : ''}
    <td valign="top" style="vertical-align: top;">
      ${name ? `<div style="font-size: 16px; font-weight: 600; color: #1a1a1a; line-height: 1.3; margin-bottom: 2px;">${name}</div>` : ''}
      ${title ? `<div style="font-size: 14px; color: #666666; margin-bottom: 4px; font-weight: 400;">${title}</div>` : ''}
      ${company ? `
      <div style="margin-bottom: 6px;">
        ${hasCompanyUrl ? `
        <a href="${companyUrl}" style="color: #1a1a1a; text-decoration: none; font-size: 14px; font-weight: 500;">${company}</a>
        ` : `
        <span style="color: #1a1a1a; font-size: 14px; font-weight: 500;">${company}</span>
        `}
      </div>
      ` : ''}
      ${hasContactInfo ? `
      <div style="font-size: 14px; line-height: 1.4;">
        ${email ? `<div style="margin-bottom: 1px;"><a href="mailto:${email}" style="color: #0066cc; text-decoration: none;">${email}</a></div>` : ''}
        ${phone ? `<div><a href="tel:${phone.replace(/\s/g, '')}" style="color: #666666; text-decoration: none;">${phone}</a></div>` : ''}
      </div>
      ` : ''}
    </td>
  </tr>
</table>`.trim();
}

// Function to generate a plain text preview for the UI
export function generateSignaturePreview(data: SignatureData): string {
  const {
    name = '',
    title = '',
    company = '',
    companyUrl = '',
    phone = '',
    email = '',
    photoUrl = ''
  } = data;

  if (!name && !title && !company && !phone && !email) {
    return 'No signature configured';
  }

  let preview = '';
  
  if (name) preview += `${name}\n`;
  if (title) preview += `${title}\n`;
  if (company) {
    if (companyUrl) {
      preview += `${company} (${companyUrl})\n`;
    } else {
      preview += `${company}\n`;
    }
  }
  if (email) preview += `📧 ${email}\n`;
  if (phone) preview += `📞 ${phone}\n`;
  
  if (photoUrl) preview += `👤 Profile Photo\n`;

  return preview.trim();
}
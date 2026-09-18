const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

export const adminEmails = configuredAdminEmail ? [configuredAdminEmail] : [];
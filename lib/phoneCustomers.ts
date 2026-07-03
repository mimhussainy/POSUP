import AsyncStorage from '@react-native-async-storage/async-storage';

export type PhoneCustomer = {
  first_name: string;
  last_name: string;
  phone: string;
  street: string;
  zip: string;
  city: string;
};

export const emptyPhoneCustomer: PhoneCustomer = {
  first_name: '',
  last_name: '',
  phone: '',
  street: '',
  zip: '',
  city: '',
};

export const phoneCustomersStorageKey = (code: string) =>
  `posup_phone_customers_${code || 'default'}`;

export function cleanPhoneCustomer(customer: PhoneCustomer): PhoneCustomer {
  return {
    first_name: String(customer.first_name || '').trim(),
    last_name: String(customer.last_name || '').trim(),
    phone: String(customer.phone || '').trim(),
    street: String(customer.street || '').trim(),
    zip: String(customer.zip || '').trim(),
    city: String(customer.city || '').trim(),
  };
}

export function normalizedPhone(value: string) {
  return String(value || '').replace(/\D/g, '');
}

export function normalizeCustomerText(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export async function loadPhoneCustomers(code: string): Promise<PhoneCustomer[]> {
  try {
    const raw = await AsyncStorage.getItem(phoneCustomersStorageKey(code));
    const parsed = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(cleanPhoneCustomer);
  } catch (e) {
    return [];
  }
}

export async function savePhoneCustomer(
  code: string,
  customer: PhoneCustomer
): Promise<PhoneCustomer[]> {
  const cleaned = cleanPhoneCustomer(customer);

  if (!cleaned.phone && !cleaned.first_name && !cleaned.last_name) {
    return loadPhoneCustomers(code);
  }

  const current = await loadPhoneCustomers(code);
  const customerPhone = normalizedPhone(cleaned.phone);
  const customerNameStreet = normalizeCustomerText(
    `${cleaned.first_name} ${cleaned.last_name} ${cleaned.street}`
  ).trim();

  const existingIndex = current.findIndex(c => {
    const savedPhone = normalizedPhone(c.phone);

    if (customerPhone && savedPhone === customerPhone) {
      return true;
    }

    return normalizeCustomerText(`${c.first_name} ${c.last_name} ${c.street}`).trim() === customerNameStreet;
  });

  const updated = [...current];

  if (existingIndex >= 0) {
    updated[existingIndex] = cleaned;
  } else {
    updated.unshift(cleaned);
  }

  const limited = updated.slice(0, 200);
  await AsyncStorage.setItem(phoneCustomersStorageKey(code), JSON.stringify(limited));

  return limited;
}

export async function deletePhoneCustomer(
  code: string,
  customer: PhoneCustomer
): Promise<PhoneCustomer[]> {
  const current = await loadPhoneCustomers(code);
  const targetPhone = normalizedPhone(customer.phone);
  const targetNameStreet = normalizeCustomerText(
    `${customer.first_name} ${customer.last_name} ${customer.street}`
  ).trim();

  const updated = current.filter(c => {
    const savedPhone = normalizedPhone(c.phone);

    if (targetPhone && savedPhone === targetPhone) {
      return false;
    }

    return normalizeCustomerText(`${c.first_name} ${c.last_name} ${c.street}`).trim() !== targetNameStreet;
  });

  await AsyncStorage.setItem(phoneCustomersStorageKey(code), JSON.stringify(updated));

  return updated;
}

export function searchPhoneCustomers(customers: PhoneCustomer[], query: string) {
  const q = normalizeCustomerText(query.trim());

  if (!q) {
    return customers;
  }

  return customers.filter(customer => {
    const haystack = normalizeCustomerText(
      `${customer.phone} ${customer.first_name} ${customer.last_name} ${customer.street} ${customer.zip} ${customer.city}`
    );

    return haystack.includes(q);
  });
}
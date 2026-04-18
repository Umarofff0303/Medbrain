function normalizeHeader(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? '');

  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function toCsv(columns, rows) {
  const headerRow = columns.map((column) => escapeCsvValue(column.header)).join(',');
  const bodyRows = rows.map((row) =>
    columns.map((column) => escapeCsvValue(row[column.key])).join(',')
  );

  return [headerRow, ...bodyRows].join('\r\n');
}

function parseCsv(text) {
  const rows = [];
  let currentRow = [];
  let currentValue = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }

      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = '';
      continue;
    }

    currentValue += char;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  return rows
    .map((row) => row.map((cell) => String(cell || '').trim()))
    .filter((row) => row.some((cell) => cell !== ''));
}

const IMPORT_FIELD_ALIASES = {
  username: ['username', 'login', 'user', 'studentlogin'],
  password: ['password', 'parol'],
  groupName: ['group', 'groupname', 'guruh'],
  lastName: ['lastname', 'last_name', 'familiya', 'surname'],
  firstName: ['firstname', 'first_name', 'ism', 'name'],
  fatherName: ['fathername', 'father_name', 'otasiningismi', 'middlename', 'middle_name']
};

const REQUIRED_IMPORT_FIELDS = ['username', 'password', 'groupName', 'lastName', 'firstName', 'fatherName'];

function resolveFieldIndexes(headerRow) {
  const indexes = new Map();

  headerRow.forEach((header, index) => {
    const normalized = normalizeHeader(header);

    for (const [field, aliases] of Object.entries(IMPORT_FIELD_ALIASES)) {
      if (aliases.includes(normalized) && !indexes.has(field)) {
        indexes.set(field, index);
      }
    }
  });

  return indexes;
}

export function parseStudentIdentity(rawFullName) {
  const raw = String(rawFullName || '').trim();

  if (!raw) {
    return {
      groupName: '',
      displayName: '',
      lastName: '',
      firstName: '',
      fatherName: ''
    };
  }

  const [groupPart, ...nameParts] = raw.split('|');
  const groupName = nameParts.length > 0 ? groupPart.trim() : '';
  const displayName = (nameParts.length > 0 ? nameParts.join('|') : raw).trim();
  const tokens = displayName.split(/\s+/).filter(Boolean);

  return {
    groupName,
    displayName,
    lastName: tokens[0] || '',
    firstName: tokens[1] || '',
    fatherName: tokens.slice(2).join(' ')
  };
}

export function parseStudentImportCsv(text) {
  const rows = parseCsv(String(text || '').replace(/^\uFEFF/, ''));

  if (rows.length < 2) {
    throw new Error("CSV faylda sarlavha va kamida bitta talaba qatori bo'lishi kerak.");
  }

  const fieldIndexes = resolveFieldIndexes(rows[0]);
  const missingFields = REQUIRED_IMPORT_FIELDS.filter((field) => !fieldIndexes.has(field));

  if (missingFields.length > 0) {
    throw new Error(
      `CSV sarlavhalari yetarli emas. Kerakli ustunlar: login, parol, guruh, familiya, ism, otasining_ismi.`
    );
  }

  const students = [];
  const errors = [];

  rows.slice(1).forEach((row, index) => {
    const lineNumber = index + 2;
    const student = {
      username: row[fieldIndexes.get('username')] || '',
      password: row[fieldIndexes.get('password')] || '',
      groupName: row[fieldIndexes.get('groupName')] || '',
      lastName: row[fieldIndexes.get('lastName')] || '',
      firstName: row[fieldIndexes.get('firstName')] || '',
      fatherName: row[fieldIndexes.get('fatherName')] || ''
    };

    const isEmpty = Object.values(student).every((value) => String(value || '').trim() === '');
    if (isEmpty) {
      return;
    }

    const missingValueFields = Object.entries(student)
      .filter(([, value]) => String(value || '').trim() === '')
      .map(([key]) => key);

    if (missingValueFields.length > 0) {
      errors.push(`${lineNumber}-qator to'liq emas.`);
      return;
    }

    students.push({
      username: student.username.trim(),
      password: student.password,
      groupName: student.groupName.trim(),
      lastName: student.lastName.trim(),
      firstName: student.firstName.trim(),
      fatherName: student.fatherName.trim()
    });
  });

  if (errors.length > 0) {
    throw new Error(errors.slice(0, 8).join(' '));
  }

  if (students.length === 0) {
    throw new Error("CSV faylda import qilinadigan talaba topilmadi.");
  }

  return students;
}

export function createStudentImportTemplateCsv() {
  return toCsv(
    [
      { key: 'username', header: 'login' },
      { key: 'password', header: 'parol' },
      { key: 'groupName', header: 'guruh' },
      { key: 'lastName', header: 'familiya' },
      { key: 'firstName', header: 'ism' },
      { key: 'fatherName', header: 'otasining_ismi' }
    ],
    [
      {
        username: 'student_203_01',
        password: '1234',
        groupName: '203-A',
        lastName: 'Karimov',
        firstName: 'Aziz',
        fatherName: 'Anvarovich'
      }
    ]
  );
}

export function createStudentsExportCsv(students) {
  const rows = (Array.isArray(students) ? students : []).map((student) => {
    const identity = parseStudentIdentity(student.full_name);
    const stats = student.stats || {};
    const lastAttempt = student.lastAttempt || student.latestAttempt || null;

    return {
      username: student.username || '',
      groupName: identity.groupName || '',
      lastName: identity.lastName || '',
      firstName: identity.firstName || '',
      fatherName: identity.fatherName || '',
      attemptsCount: stats.attemptsCount ?? student.attemptsCount ?? '',
      solvedTestsCount: stats.solvedTestsCount ?? (student.solved ? 1 : 0),
      submittedCount: stats.submittedCount ?? student.submittedCount ?? '',
      averageScore: stats.averageScore ?? '',
      bestScore: stats.bestScore ?? '',
      lastTestTitle: lastAttempt?.testTitle || '',
      lastStatus: lastAttempt?.status || '',
      lastScore: lastAttempt?.score ?? '',
      lastTotalQuestions: lastAttempt?.totalQuestions ?? '',
      createdAt: student.created_at || ''
    };
  });

  return toCsv(
    [
      { key: 'username', header: 'login' },
      { key: 'groupName', header: 'guruh' },
      { key: 'lastName', header: 'familiya' },
      { key: 'firstName', header: 'ism' },
      { key: 'fatherName', header: 'otasining_ismi' },
      { key: 'attemptsCount', header: 'urinishlar' },
      { key: 'solvedTestsCount', header: 'yechilgan_testlar' },
      { key: 'submittedCount', header: 'yakunlangan_testlar' },
      { key: 'averageScore', header: 'ortacha_ball' },
      { key: 'bestScore', header: 'eng_yaxshi_ball' },
      { key: 'lastTestTitle', header: 'oxirgi_test' },
      { key: 'lastStatus', header: 'oxirgi_holat' },
      { key: 'lastScore', header: 'oxirgi_ball' },
      { key: 'lastTotalQuestions', header: 'oxirgi_jami_savollar' },
      { key: 'createdAt', header: 'yaratilgan_vaqt' }
    ],
    rows
  );
}

export function downloadCsvFile(filename, content) {
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

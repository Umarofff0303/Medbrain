const ALLOWED_TOPICS_BY_SCOPE = {
  'davolash::ichki kasalliklar': [
    'yurak ishemik kasalligi (stenokardiya)',
    'miokard infarkti',
    'gipertoniya kasalliklar',
    "o'tkir revmatik isitma",
    'mitral va aortal klapan nuqsonlari',
    'surunkali yurak yetishmovchiligi',
    'pnevmoniyalar',
    'oshqozon yaralari',
    'gepatitlar',
    'jigar sirrozi',
    'piyelonefritlar',
    'glomerulonefritlar',
    "sistemali qizil bo'richa",
    'revmatoid artrit'
  ],
  'stomatologiya::terapevtik stomatologiya': [
    'tish kariyesi diagnostikasi',
    'pulpit va periodontit',
    'gingivit va parodontit',
    'endodontik davolash asoslari',
    'tish toshlari va professional gigiyena',
    'stomatitlar',
    'tish restavratsiyasi materiallari'
  ],
  'pediatriya::bolalar kasalliklari': [
    'bolalarda orvi va bronxiolit',
    'bolalar pnevmoniyasi',
    'tugma yurak nuqsonlari',
    'bolalarda anemiya',
    'bolalarda nefrit va piyelonefrit',
    'pediatrik emlash kalendari',
    'bolalarda allergik kasalliklar'
  ],
  'tibbiy biologiya::klinik biologiya': [
    'gematologik analizlar interpretatsiyasi',
    'immunologik markerlar',
    'pcr diagnostikasi asoslari',
    'biokimyoviy korsatkichlar tahlili',
    'molekulyar biologiya va genetik testlar',
    'laboratoriya sifat nazorati'
  ],
  'tibbiy profilaktika::profilaktik tibbiyot': [
    'epidemiologik nazorat asoslari',
    'vaksinoprofilaktika',
    'skrining dasturlari',
    'sanitariya gigiyena nazorati',
    'surunkali kasalliklar profilaktikasi',
    "sog'lom turmush tarzi va xavf omillari",
    'infeksion kasalliklarda kontaktlarni kuzatish'
  ],
  'xalq tabobati::ichki kasalliklar': [
    'fitoterapiya asoslari',
    'ovqat hazm tizimi kasalliklarida xalq tabobati',
    'arterial bosimni tabiiy boshqarish',
    'stress va uyquni tabiiy usullar bilan boshqarish',
    'immunitetni qollab quvvatlash usullari',
    'xalq tabobatida xavfsizlik va qarshi korsatmalar'
  ]
};

function normalizePolicyText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9\s()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildScopeKey(facultyName, directionName) {
  return `${normalizePolicyText(facultyName)}::${normalizePolicyText(directionName)}`;
}

export function isAllowedTopicForScope(facultyName, directionName, topicName) {
  const scopeKey = buildScopeKey(facultyName, directionName);
  const allowedTopics = ALLOWED_TOPICS_BY_SCOPE[scopeKey];

  if (!allowedTopics) {
    return true;
  }

  return allowedTopics.includes(normalizePolicyText(topicName));
}

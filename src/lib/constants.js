export const DAILY_LIMIT = 6
export const MAX_PHOTOS = 6
export const MIN_DISCOVERY_PHOTOS = 5

export const GENDER_IDENTITIES = [
  ['woman', 'Woman'],
  ['man', 'Man'],
  ['non_binary', 'Non-binary'],
  ['prefer_not_to_say', 'Prefer not to say'],
]

export const ORIENTATIONS = [
  ['straight', 'Straight'],
  ['gay', 'Gay'],
  ['lesbian', 'Lesbian'],
  ['bisexual', 'Bisexual'],
  ['pansexual', 'Pansexual'],
  ['queer', 'Queer'],
  ['questioning', 'Questioning'],
  ['prefer_not_to_say', 'Prefer not to say'],
]

export const INTERESTED_GENDERS = GENDER_IDENTITIES
export const DATING_INTENTIONS = [
  ['long_term', 'A long-term relationship'],
  ['short_term', 'Something casual'],
  ['friendship', 'New friends first'],
  ['open_to_seeing', 'Open to seeing where it goes'],
]
export const SMOKING_OPTIONS = ['Never', 'Sometimes', 'Regularly', 'Prefer not to say']
export const DRINKING_OPTIONS = ['Never', 'Sometimes', 'Socially', 'Regularly', 'Prefer not to say']
export const MUSIC_GENRES = [
  'Amapiano', 'Afrobeats', 'Hip-hop', 'R&B', 'House', 'Gospel', 'Pop', 'Rock', 'Jazz', 'Other',
]

export const UNIVERSITIES = [
  'University of Cape Town', 'University of the Witwatersrand', 'University of Pretoria',
  'Stellenbosch University', 'University of Johannesburg', 'University of KwaZulu-Natal',
  'University of the Free State', 'North-West University', 'Rhodes University',
  'Nelson Mandela University', 'University of the Western Cape', 'University of Limpopo',
  'University of Fort Hare', 'University of Venda', 'University of Zululand',
  'University of Mpumalanga', 'Sol Plaatje University', 'Walter Sisulu University',
  'University of South Africa (Unisa)', 'Tshwane University of Technology',
  'Cape Peninsula University of Technology', 'Durban University of Technology',
  'Central University of Technology', 'Vaal University of Technology',
  'Mangosuthu University of Technology', 'Sefako Makgatho Health Sciences University',
]

// Approximate city centres [lat, lng]. Used to work out "km away" without needing GPS.
export const CITIES = {
  Johannesburg: [-26.2041, 28.0473], Pretoria: [-25.7479, 28.2293], 'Cape Town': [-33.9249, 18.4241],
  Durban: [-29.8587, 31.0218], Bloemfontein: [-29.0852, 26.1596], Gqeberha: [-33.9608, 25.6022],
  'East London': [-33.0292, 27.8546], Stellenbosch: [-33.9321, 18.8602], Potchefstroom: [-26.7145, 27.097],
  Polokwane: [-23.9045, 29.4689], Mahikeng: [-25.8652, 25.6443], Welkom: [-27.9774, 26.7357],
  Kimberley: [-28.7282, 24.7499], Pietermaritzburg: [-29.6006, 30.3794], Mthatha: [-31.5889, 28.7844],
  Makhanda: [-33.3042, 26.5328], Mbombela: [-25.4753, 30.9694], Vanderbijlpark: [-26.7116, 27.8383],
  Soshanguve: [-25.52, 28.1], Alice: [-32.7872, 26.835], Thohoyandou: [-22.9456, 30.4849],
  'Richards Bay': [-28.783, 32.0377], George: [-33.963, 22.4617], Bellville: [-33.9, 18.63],
  Randburg: [-26.0936, 28.0064], Soweto: [-26.2678, 27.8585], Pinetown: [-29.8167, 30.8667],
}

export const INTERESTS = [
  'Braai 🔥', 'Amapiano 🎶', 'Rugby 🏉', 'Soccer ⚽', 'Gym 💪', 'Netflix 🍿', 'Gaming 🎮', 'Hiking 🥾',
  'Beach 🏖️', 'Art 🎨', 'Coding 💻', 'Reading 📚', 'Travel ✈️', 'Dancing 💃', 'Cooking 🍳',
  'Photography 📸', 'Coffee ☕', 'Fashion 👗', 'Anime 🍥', 'Poetry ✍️', 'Study dates 📖', 'Church ⛪',
]

export const ageFrom = (birth) => {
  const b = new Date(birth), n = new Date()
  let a = n.getFullYear() - b.getFullYear()
  const m = n.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a--
  return a
}

export const choiceLabel = (choices, value) =>
  choices.find(([key]) => key === value)?.[1] || ''

export const maxBirthDate = () => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 18)
  return d.toISOString().slice(0, 10)
}

export const cityCoords = (city) => {
  const key = Object.keys(CITIES).find((c) => c.toLowerCase() === city.trim().toLowerCase())
  return key ? CITIES[key] : null
}

export const timeLabel = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export const APP_NAME = 'CampusCrush'
// Change this to a real inbox you check. It is shown on the Terms, Privacy and Safety pages.
export const SUPPORT_EMAIL = 'support@campuscrush.co.za'

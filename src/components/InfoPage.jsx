import { APP_NAME, SUPPORT_EMAIL } from '../lib/constants'

const PAGES = {
  tips: {
    title: 'Safe dating tips',
    sections: [
      ['Take your time online', 'Chat inside CampusCrush until you feel comfortable. You do not have to share your phone number, Instagram or address with anyone.'],
      ['Meet in public first', 'Choose a busy place, like a campus coffee shop or a mall. Avoid meeting at your place or theirs on a first date.'],
      ['Tell a friend', 'Share who you are meeting, where, and when. Send them a quick message when you get home.'],
      ['Arrange your own transport', 'Get there and back by yourself, so you can leave whenever you want.'],
      ['Watch your drinks', 'Keep your drink in sight and do not accept drinks you did not see being poured.'],
      ['Never send money', 'Block and report anyone who asks for money, airtime, data or gift cards, whatever the story is.'],
      ['Trust your gut', 'If something feels off, leave. You can block anyone from their profile or from your chat.'],
      ['In an emergency', 'In South Africa call 10111 (police) or 112 from a cellphone. For gender-based violence, the GBV Command Centre is open 24 hours on 0800 428 428.'],
    ],
  },
  principles: {
    title: 'Member principles',
    sections: [
      ['Be real', 'Use your own photos and your real age. One person, one account.'],
      ['Be respectful', 'No harassment, hate speech, threats, or unwanted sexual messages. A "no" or silence means stop.'],
      ['Be 18 or older', 'CampusCrush is only for adults who study at a university or college. Accounts of anyone under 18 are removed.'],
      ['Keep it legal and safe', 'No scams, no selling anything, no sharing other people\'s photos or details, and no explicit images.'],
      ['Look out for each other', 'Block and report anyone who breaks these rules. Reports are reviewed by a person and serious cases lead to a permanent ban.'],
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      ['Who we are', `${APP_NAME} ("we") is a dating service for university students in South Africa. We are the responsible party under the Protection of Personal Information Act (POPIA). Contact: ${SUPPORT_EMAIL}.`],
      ['What we collect', 'Your email address, password (stored securely, never readable by us), name, date of birth, gender identity, your orientation choice and whether you choose to show it, dating preferences, height, dating intentions, music and lifestyle preferences, university, city, bio, interests, photos, your approximate location (your city or a location rounded to about 1 km, only if you choose to share it), your likes, matches, text and voice messages, active-status timestamps, blocks and reports.'],
      ['Why we use it', 'To create your account, match you with people who meet your mutual gender and distance preferences, show profile details you choose to share, provide likes, profile boosts and chat, keep people safe, and prevent misuse. We do not sell your data.'],
      ['Who can see what', 'People who meet your mutual dating preferences can see your name, age, gender identity unless you selected "Prefer not to say", university, city, bio, interests, height, dating intentions, lifestyle preferences and photos. Your orientation appears only if you choose to show it. Matches can play voice notes shared in their chat. They cannot see your email, birth date or exact location. Photos are stored privately and can only be opened by authorized members.'],
      ['Where it is stored', 'Your data is stored with our hosting provider Supabase on servers in Ireland (European Union). Sending data outside South Africa is done only to provide the service.'],
      ['Your rights', 'You can change your details in the app, download your data (Settings, Download my data), pause your profile, and delete your account (Settings, Delete account). Deleting removes your profile, likes, matches and messages. You may also ask us questions or complain by email, or complain to the Information Regulator of South Africa.'],
      ['How long we keep it', 'We keep your data while your account is active. When you delete your account it is removed straight away. Backups may hold copies for a short period before they are overwritten.'],
      ['Children', 'You must be 18 or older. If we learn that someone is under 18 we delete the account.'],
      ['Changes', 'If we change this policy in a way that matters, we will tell you in the app.'],
    ],
  },
  terms: {
    title: 'Terms of Service',
    sections: [
      ['Using CampusCrush', `By creating an account you agree to these terms and to our Member principles. You must be 18 or older and a university or college student, and you must give true information.`],
      ['Your account', 'Keep your password private. You are responsible for what happens on your account. One person may only have one account.'],
      ['Your content', 'You own your photos and words, but you give us permission to show them to other members so the service can work. Do not post anything you do not have the right to share, anything illegal, or anything explicit.'],
      ['Behaviour', 'We may remove content, suspend or delete accounts that break our rules, with or without notice, to keep members safe.'],
      ['Meeting people', 'We do not run background checks and cannot guarantee who anyone is. You are responsible for your own safety when you meet someone. Please read our Safe dating tips.'],
      ['The service', 'We try to keep CampusCrush running but cannot promise it will always be available or error-free. To the extent the law allows, we are not responsible for losses that come from using the service or from the behaviour of other members.'],
      ['Ending your account', 'You can delete your account at any time in Settings.'],
      ['Contact', `Questions about these terms: ${SUPPORT_EMAIL}.`],
    ],
  },
}

export default function InfoPage({ kind }) {
  const page = PAGES[kind]
  return (
    <article className="doc">
      <h2 className="serif">{page.title}</h2>
      {page.sections.map(([h, t]) => (
        <section key={h}>
          <h3>{h}</h3>
          <p>{t}</p>
        </section>
      ))}
    </article>
  )
}

export const INFO_TITLES = Object.fromEntries(Object.entries(PAGES).map(([k, v]) => [k, v.title]))

import { SITE_URL } from "./seo";

export const CONTACT_EMAIL = "jose@gumwheel.com";
export const ABOUT_SUMMARY = "GUMWHEEL is a browser-based carpooling pilot in Sydney. It connects people who need a ride with drivers travelling their way.";
export const RIDER_STEPS = ["Choose your destination.", "Request to join a ride.", "Meet your driver.", "Share the journey."];
export const DRIVER_STEPS = ["Post a journey.", "Accept a rider.", "Meet your rider.", "Share the journey."];
export const HELP_FAQS = [
  {
    question: "What is GUMWHEEL?",
    answer: `${ABOUT_SUMMARY} Drivers can post a journey or respond to a rider’s journey request.`,
  },
  {
    question: "What if I can’t find a journey?",
    answer: "Use Request this journey to post where you need to go. Drivers can offer to take you, and you choose whether to accept. You can also save your usual route and opt into matching-ride emails. Availability depends on people travelling your way.",
  },
  {
    question: "Do I need an app or a university email?",
    answer: "GUMWHEEL works in your phone or desktop browser, with no app download. You can sign in with any valid email address by entering the code sent to your inbox. A university email is not required.",
  },
  {
    question: "How do I pay?",
    answer: "Rides are free unless the driver asks for a contribution. The fare is shown before you request. For paid rides, pay directly through your bank using the driver’s PayID: mobile number, email, ABN or organisation identifier. Payment details appear after pickup confirmation. GUMWHEEL does not process payments or support cash.",
  },
  {
    question: "When do I share my pickup code?",
    answer: "Share it when you meet your driver. They enter the code to confirm pickup and start the ride.",
  },
  {
    question: "Should I keep the app open?",
    answer: "Yes—keep it open with location enabled during your ride. Location updates may pause when the app is in the background or your phone is locked.",
  },
  {
    question: "Can I cancel?",
    answer: "You can withdraw a pending request or cancel an ongoing ride using its available actions.",
  },
];

// This is product information, not an agent command, public inventory or booking API.
export const PUBLIC_GUIDE = `# GUMWHEEL

> ${ABOUT_SUMMARY}

## When it may help
- Someone wants to find a driver travelling in the same direction.
- A driver wants to share a planned journey or browse rider-posted journey requests.
- A rider wants to post a journey request when no suitable ride is listed.
- Someone wants to save a usual route and opt into matching-ride emails.

## How it works
Drivers and riders review routes, departure times, contributions and profiles, then coordinate through messages. Joining or accepting an offer requires the other person's confirmation. GUMWHEEL is an early pilot; a match or available driver is not guaranteed. Email verification proves access to an inbox, not identity or driving qualifications.

## Participation
Use the website in a phone or desktop browser. No app download or university email is required. Rides can be free or include an agreed contribution. GUMWHEEL does not process payments; eligible PayID details appear after pickup confirmation.

## Public pages
- [Home](${SITE_URL}/): Find a journey or post a journey.
- [How it works](${SITE_URL}/help): Rider and driver steps and frequently asked questions.
- [About](${SITE_URL}/about): The product, pilot and contact information.
- [Sydney carpooling](${SITE_URL}/carpooling/sydney): Finding, requesting and sharing local journeys.
- [Readable guide](${SITE_URL}/help.md): The same public Help content as Markdown.
- [Privacy](${SITE_URL}/privacy): Account, journey and location data handling.
- [Terms](${SITE_URL}/terms): Participation in the carpool pilot.
- [Sitemap](${SITE_URL}/sitemap.xml): Public information pages.

## Contact
${CONTACT_EMAIL}

Account pages, private journey details, messages, email matching links and live locations are not public documentation. Use the website to check current availability and complete actions with the user's approval. This guide does not grant permission to access accounts, send messages or make bookings.
`;

export const HELP_MARKDOWN = `# How GUMWHEEL works

${ABOUT_SUMMARY}

## Find a journey
${RIDER_STEPS.map((step, index) => `${index + 1}. ${step}`).join("\n")}

## Post a journey
${DRIVER_STEPS.map((step, index) => `${index + 1}. ${step}`).join("\n")}

## Frequently asked questions
${HELP_FAQS.map(({ question, answer }) => `### ${question}\n\n${answer}`).join("\n\n")}

## Contact
${CONTACT_EMAIL}

Source: ${SITE_URL}/help
`;

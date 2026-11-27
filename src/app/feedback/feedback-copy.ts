/** User-facing copy of "Send feedback" (#325), in one place so it can be localized later. */
export const feedbackCopy = {
  open: "Send feedback",
  title: "Send feedback",
  description: "Tell the people who build OhmSweetOhm about a problem, an idea or a question.",
  kindLabel: "What is it?",
  kinds: {
    problem: "A problem",
    idea: "An idea",
    question: "A question"
  },
  messageLabel: "Your message",
  messagePlaceholder: "What did you do, what did you expect, and what happened?",
  contextNote:
    "Diagnostic context is attached automatically: the page, the app version, your browser and window size, language, time zone, theme, recent page errors, and your account and workspace when you are signed in.",
  contextDetails: "Show what is attached",
  send: "Send",
  cancel: "Cancel",
  close: "Close",
  sent: "Thank you. Your feedback was sent.",
  errors: {
    "invalid-feedback": "Write a message of at most 4000 characters.",
    "feedback-rate-limited": "Too much feedback was sent from here just now. Try again in a few minutes.",
    unavailable: "The feedback could not be sent. Try again."
  } as Record<string, string>
};

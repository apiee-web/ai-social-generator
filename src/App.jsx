import { useState } from "react";

const platforms = ["LinkedIn", "Twitter", "Instagram"];
const tones = ["Professional", "Funny", "Casual"];

const postTemplates = {
  Professional: [
    (topic) =>
      `The future of ${topic} is being shaped by the ideas we put into action today.\n\nStay curious, keep learning, and make room for meaningful progress. What’s one change you’re excited to see?`,
    (topic) =>
      `A fresh perspective on ${topic} can make all the difference.\n\nThe best results come from thoughtful questions, consistent effort, and a willingness to adapt. What’s been your biggest takeaway?`,
  ],
  Funny: [
    (topic) =>
      `Me: “I’ll just spend five minutes thinking about ${topic}.”\nAlso me, three hours later: I have a whiteboard and a theory.\n\nAnyone else? 😅`,
    (topic) =>
      `I tried to explain ${topic} in one sentence.\n\nIt’s been 47 sentences and a snack break. So, basically, progress. 😂`,
  ],
  Casual: [
    (topic) =>
      `Been thinking a lot about ${topic} lately. There’s always something new to learn, and that’s what makes it fun.\n\nWhat’s your take?`,
    (topic) =>
      `A little reminder about ${topic}: you don’t have to have it all figured out to get started. One step at a time ✨`,
  ],
};

const platformNotes = {
  LinkedIn: "Share your perspective in the comments.",
  Twitter: "What do you think? 👇",
  Instagram: "Save this for later ✨",
};

export default function App() {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("LinkedIn");
  const [tone, setTone] = useState("Professional");
  const [post, setPost] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  function generatePost(event) {
    event.preventDefault();
    const cleanTopic = topic.trim();
    if (!cleanTopic) return;

    const templates = postTemplates[tone];
    const template = templates[Math.floor(Math.random() * templates.length)];
    setPost(`${template(cleanTopic)}\n\n${platformNotes[platform]}`);
    setCopied(false);
    setCopyError(false);
  }

  async function copyPost() {
    try {
      await navigator.clipboard.writeText(post);
      setCopied(true);
      setCopyError(false);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fc] px-4 py-10 text-slate-900 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600 text-2xl text-white shadow-lg shadow-violet-200" aria-hidden="true">
            ✳
          </div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-violet-600">
            Your next post starts here
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Social Post Generator
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-7 text-slate-500">
            Turn an idea into a post that sounds like you. Pick a platform, set
            the tone, and let the inspiration flow.
          </p>
        </header>

        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-9" aria-label="Post generator">
          <form onSubmit={generatePost} className="space-y-6">
            <div>
              <label htmlFor="topic" className="mb-2 block text-sm font-semibold text-slate-700">
                What’s your post about?
              </label>
              <textarea
                id="topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="e.g. launching a new product, building healthy habits..."
                rows={3}
                required
                className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="platform" className="mb-2 block text-sm font-semibold text-slate-700">
                  Platform
                </label>
                <select
                  id="platform"
                  value={platform}
                  onChange={(event) => setPlatform(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                >
                  {platforms.map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="tone" className="mb-2 block text-sm font-semibold text-slate-700">
                  Tone of voice
                </label>
                <select
                  id="tone"
                  value={tone}
                  onChange={(event) => setTone(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                >
                  {tones.map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-4 font-semibold text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700 focus:outline-none focus:ring-4 focus:ring-violet-200 active:scale-[0.99]"
            >
              <span aria-hidden="true">✦</span>
              Generate post
            </button>
          </form>

          {post && (
            <div aria-live="polite" className="mt-8 overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-indigo-50">
              <div className="flex items-center justify-between border-b border-violet-100 px-5 py-4">
                <div>
                  <p className="text-sm font-bold text-slate-800">Your {platform} post</p>
                  <p className="mt-0.5 text-xs text-slate-500">Written in a {tone.toLowerCase()} tone</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-violet-700 shadow-sm">
                  Ready to share
                </span>
              </div>

              <p className="whitespace-pre-line px-5 py-6 text-[15px] leading-7 text-slate-700">{post}</p>

              <div className="px-5 pb-5">
                <button
                  type="button"
                  onClick={copyPost}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-violet-300 hover:text-violet-700 focus:outline-none focus:ring-4 focus:ring-violet-100"
                >
                  {copied ? "✓ Copied!" : "Copy to clipboard"}
                </button>
                {copyError && <p className="mt-2 text-sm text-rose-600" role="alert">Couldn’t copy automatically. Check your browser clipboard permissions.</p>}
              </div>
            </div>
          )}
        </section>

        <p className="mt-6 text-center text-sm text-slate-400">
          A little inspiration, ready when you are.
        </p>
      </div>
    </main>
  );
}

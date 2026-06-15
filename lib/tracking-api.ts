const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export const saveLearningSession = async (
  sessions: { wordId: string; status: "known" | "review"; userId: string }[]
) => {
  if (sessions.length === 0) return;
  await fetch(`${API_URL}/learningsession/many`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ data: sessions }),
  });
};

export const saveQuizResult = async (data: {
  userId: string;
  level: string;
  unit: number;
  score: number;
  total: number;
}) => {
  await fetch(`${API_URL}/quizresult/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ data }),
  });
};
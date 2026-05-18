import { z } from 'zod';

// Multiple-choice question generated from an article. Four options,
// one correct index. The explanation is shown after the user picks an
// answer (right or wrong) — it's how the quiz turns into a learning
// moment instead of a trivia game.
//
// Generated server-side by Haiku 4.5 (see apps/web/src/lib/quiz.ts)
// from the article's title + hook + extract.
export const quizQuestionSchema = z.object({
  question: z.string().min(8).max(500),
  options: z.tuple([z.string(), z.string(), z.string(), z.string()]),
  correctIndex: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  explanation: z.string().min(8).max(700),
});
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

export const generateQuizRequestSchema = z.object({
  wikiId: z.string().min(1),
});
export type GenerateQuizRequest = z.infer<typeof generateQuizRequestSchema>;

export const generateQuizResponseSchema = z.object({
  quiz: quizQuestionSchema,
});
export type GenerateQuizResponse = z.infer<typeof generateQuizResponseSchema>;

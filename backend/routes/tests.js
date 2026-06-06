const express = require('express');
const multer = require('multer');
const Test = require('../models/Test');
const TestAttempt = require('../models/TestAttempt');
const { protect } = require('./auth');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const ensureTeacher = (req, res, next) => {
  if (req.user?.role !== 'teacher') {
    return res.status(403).json({ success: false, message: 'Teacher access required' });
  }
  next();
};

const ensureStudent = (req, res, next) => {
  if (req.user?.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Student access required' });
  }
  next();
};

const normalizeAnswer = (value) => {
  if (value === undefined || value === null) return null;
  const answer = String(value).trim().toUpperCase();
  if (!answer) return null;
  if (/^[A-Z]$/.test(answer)) return answer.charCodeAt(0) - 65;
  const numericAnswer = Number(answer);
  return Number.isInteger(numericAnswer) && numericAnswer > 0 ? numericAnswer - 1 : null;
};

const normalizeSubmittedAnswer = (value) => {
  if (Number.isInteger(value)) return value;
  if (value === undefined || value === null) return null;

  const answer = String(value).trim().toUpperCase();
  if (!answer) return null;
  if (/^[A-Z]$/.test(answer)) return answer.charCodeAt(0) - 65;

  const numericAnswer = Number(answer);
  return Number.isInteger(numericAnswer) ? numericAnswer : null;
};

const parseAnswerKey = (buffer) => {
  const text = buffer.toString('utf8').trim();
  if (!text) {
    throw new Error('Answer key file is empty');
  }

  try {
    const parsed = JSON.parse(text);
    const entries = Array.isArray(parsed) ? parsed : Object.values(parsed);
    return entries.map(normalizeAnswer);
  } catch (err) {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .reduce((answers, line) => {
        const hasQuestionNumber = /^\s*\d+[\.)]?\s*/.test(line);
        const cleaned = line.replace(/^\s*\d+[\.)]?\s*[:\-]?\s*/, '').trim();
        const answer = normalizeAnswer(cleaned);

        if (answer !== null || hasQuestionNumber) {
          answers.push(answer);
        }

        return answers;
      }, []);
  }
};

const parseQuestionRows = (buffer) => {
  const text = buffer.toString('utf8').trim();
  if (!text) {
    throw new Error('Question file is empty');
  }

  const stripQuestionNumber = (line) => line.replace(/^\s*\d+[\.)]?\s*/, '').trim();
  const stripOptionLabel = (line) => line.replace(/^\s*[-*]?\s*([A-Da-d])[\.|\)|:]\s*/, '').trim();

  const isOptionLine = (line) => {
    return /^[A-Da-d][\.|\)|:]\s*/.test(line.trim()) || /^[-*]?\s*[A-Da-d][\.|\)|:]\s*/.test(line.trim());
  };
  const isLooseOptionLine = (line) => {
    const trimmed = line.trim();
    return /^[A-Da-d]\s+/.test(trimmed) && trimmed.length < 120;
  };
  const parseInlineQuestion = (line) => {
    const normalized = stripQuestionNumber(line);
    if (!normalized) return null;

    if (normalized.includes('|')) {
      const parts = normalized.split('|').map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 3) return { question: parts[0], options: parts.slice(1) };
    }

    if (normalized.match(/[A-Da-d][\.|\)]\s*/)) {
      const parts = normalized.split(/\s+[A-Da-d][\.|\)]\s*/).map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 3) {
        return { question: parts[0], options: parts.slice(1) };
      }
    }

    if (normalized.includes(',')) {
      const parts = normalized.split(',').map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 3) return { question: parts[0], options: parts.slice(1) };
    }

    return null;
  };

  const parseLines = (lines) => {
    const rows = [];
    let currentBlock = [];

    const flushBlock = () => {
      if (!currentBlock.length) return;
      const questionLine = currentBlock.find((line) => /^\s*\d+[\.)]?\s*/.test(line));
      const blockText = currentBlock.join(' ');

      if (!questionLine) {
        const inline = parseInlineQuestion(blockText);
        if (inline) {
          rows.push(inline);
        }
        currentBlock = [];
        return;
      }

      const questionText = stripQuestionNumber(questionLine);
      const options = currentBlock
        .filter((line) => line !== questionLine)
        .map((line) => {
          const optionMatch = line.match(/^\s*[-*]?\s*([A-Da-d])[\.\)|:]\s*(.+)$/);
          if (optionMatch) return optionMatch[2].trim();
          const looseOptionMatch = line.match(/^\s*([A-Da-d])\s+(.+)$/);
          if (looseOptionMatch && line.length < 120) return looseOptionMatch[2].trim();
          return null;
        })
        .filter(Boolean);

      if (options.length >= 2) {
        rows.push({ question: questionText.trim(), options });
      } else {
        const inline = parseInlineQuestion(blockText);
        if (inline) rows.push(inline);
      }

      currentBlock = [];
    };

    for (const originalLine of lines) {
      const line = originalLine.trim();
      if (!line) continue;
      if (/^\s*answer/i.test(line) || /^\s*correct/i.test(line)) continue;

      if (/^\s*\d+[\.)]?\s*/.test(line) && currentBlock.length) {
        flushBlock();
      }
      currentBlock.push(line);
    }

    flushBlock();
    return rows;
  };

  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error('JSON question file must be an array');
    }
    return parsed.map((item) => ({
      question: item.question || item.text,
      options: item.options || [item.a, item.b, item.c, item.d].filter(Boolean),
      answer: item.answer || item.correctAnswer,
    }));
  } catch (err) {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return parseLines(lines);
  }
};

const buildQuestions = (questionFile, answerKeyFile) => {
  const answerKey = parseAnswerKey(answerKeyFile.buffer);
  const rows = parseQuestionRows(questionFile.buffer);

  if (!rows.length) {
    throw new Error('No questions found in the question file');
  }

  return rows.map((row, index) => {
    const options = row.options?.map((option) => String(option).trim()).filter(Boolean) || [];
    const correctAnswer = normalizeAnswer(row.answer) ?? answerKey[index];

    if (!row.question?.trim()) {
      throw new Error(`Question ${index + 1} is missing question text`);
    }
    if (options.length < 2) {
      throw new Error(`Question ${index + 1} needs at least two options`);
    }
    if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer >= options.length) {
      throw new Error(`Question ${index + 1} has an invalid or missing answer key`);
    }

    return {
      question: row.question.trim(),
      options,
      correctAnswer,
    };
  });
};

const serializeTestForStudent = (test, attempt = null) => ({
  _id: test._id,
  title: test.title,
  description: test.description,
  durationMinutes: test.durationMinutes,
  teacherId: test.teacherId,
  createdAt: test.createdAt,
  totalQuestions: test.questions.length,
  attempt: attempt ? {
    _id: attempt._id,
    status: attempt.status,
    score: attempt.score,
    totalQuestions: attempt.totalQuestions,
    submittedAt: attempt.submittedAt,
    expiresAt: attempt.expiresAt,
  } : null,
});

const serializeTestForAttempt = (test) => ({
  _id: test._id,
  title: test.title,
  description: test.description,
  durationMinutes: test.durationMinutes,
  questions: test.questions.map((question) => ({
    _id: question._id,
    question: question.question,
    options: question.options,
  })),
});

const resetAttempt = (test, studentId) => {
  const startedAt = new Date();

  return TestAttempt.findOneAndUpdate(
    { testId: test._id, studentId },
    {
      $set: {
        startedAt,
        submittedAt: null,
        expiresAt: new Date(startedAt.getTime() + test.durationMinutes * 60 * 1000),
        responses: [],
        score: 0,
        totalQuestions: test.questions.length,
        status: 'in-progress',
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

router.get('/teacher', protect, ensureTeacher, async (req, res) => {
  try {
    const tests = await Test.find({ teacherId: req.user._id })
      .select('-questions.correctAnswer')
      .sort({ createdAt: -1 });

    res.json({ success: true, tests });
  } catch (err) {
    console.error('Fetch teacher tests error:', err);
    res.status(500).json({ success: false, message: 'Could not fetch tests' });
  }
});

router.post(
  '/',
  protect,
  ensureTeacher,
  upload.fields([{ name: 'questionsFile', maxCount: 1 }, { name: 'answerKeyFile', maxCount: 1 }]),
  async (req, res) => {
    try {
      const { title, description, durationMinutes } = req.body;
      const questionFile = req.files?.questionsFile?.[0];
      const answerKeyFile = req.files?.answerKeyFile?.[0];

      if (!title?.trim()) {
        return res.status(400).json({ success: false, message: 'Test title is required' });
      }
      if (!questionFile || !answerKeyFile) {
        return res.status(400).json({ success: false, message: 'Upload both question and answer key files' });
      }

      const duration = Number(durationMinutes);
      if (!Number.isFinite(duration) || duration < 1) {
        return res.status(400).json({ success: false, message: 'Duration must be at least 1 minute' });
      }

      const questions = buildQuestions(questionFile, answerKeyFile);
      const test = await Test.create({
        title: title.trim(),
        description: description?.trim() || '',
        durationMinutes: duration,
        teacherId: req.user._id,
        questions,
        sourceFilename: questionFile.originalname,
      });

      res.status(201).json({ success: true, test });
    } catch (err) {
      console.error('Create test error:', err);
      res.status(400).json({ success: false, message: err.message || 'Could not create test' });
    }
  }
);

router.get('/available', protect, ensureStudent, async (req, res) => {
  try {
    const tests = await Test.find({ isPublished: true })
      .populate('teacherId', 'name avatar')
      .sort({ createdAt: -1 });
    const attempts = await TestAttempt.find({
      studentId: req.user._id,
      testId: { $in: tests.map((test) => test._id) },
    });
    const attemptsByTest = new Map(attempts.map((attempt) => [attempt.testId.toString(), attempt]));

    res.json({
      success: true,
      tests: tests.map((test) => serializeTestForStudent(test, attemptsByTest.get(test._id.toString()))),
    });
  } catch (err) {
    console.error('Fetch available tests error:', err);
    res.status(500).json({ success: false, message: 'Could not fetch tests' });
  }
});

router.post('/:testId/start', protect, ensureStudent, async (req, res) => {
  try {
    const test = await Test.findOne({ _id: req.params.testId, isPublished: true });
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found' });
    }

    let attempt = await TestAttempt.findOne({ testId: test._id, studentId: req.user._id });
    if (!attempt) attempt = await resetAttempt(test, req.user._id);

    res.json({
      success: true,
      test: serializeTestForAttempt(test),
      attempt,
    });
  } catch (err) {
    console.error('Start test error:', err);
    res.status(500).json({ success: false, message: 'Could not start test' });
  }
});

router.post('/:testId/retake', protect, ensureStudent, async (req, res) => {
  try {
    const test = await Test.findOne({ _id: req.params.testId, isPublished: true });
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found' });
    }

    const attempt = await resetAttempt(test, req.user._id);

    res.json({
      success: true,
      test: serializeTestForAttempt(test),
      attempt,
    });
  } catch (err) {
    console.error('Retake test error:', err);
    res.status(500).json({ success: false, message: 'Could not retake test' });
  }
});

router.post('/:testId/submit', protect, ensureStudent, async (req, res) => {
  try {
    const test = await Test.findById(req.params.testId);
    const attempt = await TestAttempt.findOne({ testId: req.params.testId, studentId: req.user._id });

    if (!test || !attempt) {
      return res.status(404).json({ success: false, message: 'Test attempt not found' });
    }
    if (attempt.status === 'submitted') {
      return res.json({ success: true, attempt });
    }

    const answerMap = new Map(
      Object.entries(req.body.responses || {}).map(([questionId, answer]) => [questionId, normalizeSubmittedAnswer(answer)])
    );

    let score = 0;
    const responses = test.questions.map((question) => {
      const selectedAnswer = answerMap.get(question._id.toString());
      const isCorrect = selectedAnswer === question.correctAnswer;
      if (isCorrect) score += 1;
      return {
        questionId: question._id,
        selectedAnswer: Number.isInteger(selectedAnswer) ? selectedAnswer : null,
        isCorrect,
      };
    });

    attempt.responses = responses;
    attempt.score = score;
    attempt.submittedAt = new Date();
    attempt.status = 'submitted';
    await attempt.save();

    res.json({
      success: true,
      result: {
        score,
        totalQuestions: test.questions.length,
        percentage: Math.round((score / test.questions.length) * 100),
        submittedAt: attempt.submittedAt,
      },
    });
  } catch (err) {
    console.error('Submit test error:', err);
    res.status(500).json({ success: false, message: 'Could not submit test' });
  }
});

module.exports = router;

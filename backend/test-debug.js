const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Test = require('./models/Test');
const User = require('./models/User');

const run = async () => {
  await mongoose.connect(process.env.CONNECTION_STRING);
  console.log('Connected to MongoDB');

  // Check existing tests
  const tests = await Test.find({});
  console.log(`\nTotal tests in DB: ${tests.length}\n`);
  for (const t of tests) {
    console.log(`- "${t.title}" | ${t.questions.length} questions | published: ${t.isPublished} | teacher: ${t.teacherId}`);
    if (t.questions.length > 0) {
      console.log(`  Q1: "${t.questions[0].question}"`);
      console.log(`  Options: ${t.questions[0].options.join(' | ')}`);
      console.log(`  Correct: ${t.questions[0].correctAnswer}`);
    }
  }

  // Check teachers
  const teachers = await User.find({ role: 'teacher' });
  console.log(`\nTeachers: ${teachers.map(t => `${t.name} (${t._id})`).join(', ')}`);

  // Try creating a test manually
  console.log('\n--- Creating test manually ---');
  try {
    const teacher = teachers[0];
    if (!teacher) throw new Error('No teacher found');

    const test = await Test.create({
      title: 'Manual Test',
      description: 'Testing creation',
      durationMinutes: 10,
      teacherId: teacher._id,
      questions: [
        {
          question: 'What is 2 + 2?',
          options: ['3', '4', '5', '6'],
          correctAnswer: 1,
        },
        {
          question: 'What is the capital of India?',
          options: ['Mumbai', 'Delhi', 'Chennai', 'Kolkata'],
          correctAnswer: 1,
        }
      ],
    });
    console.log(`✅ Test created: ${test._id}, published: ${test.isPublished}`);
    
    // Check if it would appear for students
    const availableTests = await Test.find({ isPublished: true });
    console.log(`Available tests for students: ${availableTests.length}`);
    
    // Clean up
    await Test.deleteOne({ _id: test._id });
    console.log('Cleaned up manual test.');
  } catch (err) {
    console.error('❌ Test creation error:', err.message);
  }

  // Test the file parsing logic
  console.log('\n--- Testing file parsing ---');
  const { buildQuestions, parseQuestionRows, parseAnswerKey } = (() => {
    const normalizeAnswer = (value) => {
      if (value === undefined || value === null) return null;
      const answer = String(value).trim().toUpperCase();
      if (!answer) return null;
      if (/^[A-Z]$/.test(answer)) return answer.charCodeAt(0) - 65;
      const numericAnswer = Number(answer);
      return Number.isInteger(numericAnswer) && numericAnswer > 0 ? numericAnswer - 1 : null;
    };

    const parseAnswerKey = (buffer) => {
      const text = buffer.toString('utf8').trim();
      if (!text) throw new Error('Answer key file is empty');
      try {
        const parsed = JSON.parse(text);
        const entries = Array.isArray(parsed) ? parsed : Object.values(parsed);
        return entries.map(normalizeAnswer);
      } catch {
        return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
          .reduce((answers, line) => {
            const hasQNum = /^\s*\d+[\.)]?\s*/.test(line);
            const cleaned = line.replace(/^\s*\d+[\.)]?\s*[:\-]?\s*/, '').trim();
            const answer = normalizeAnswer(cleaned);
            if (answer !== null || hasQNum) answers.push(answer);
            return answers;
          }, []);
      }
    };

    const parseQuestionRows = (buffer) => {
      const text = buffer.toString('utf8').trim();
      if (!text) throw new Error('Question file is empty');
      try {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) throw new Error('JSON question file must be an array');
        return parsed.map(item => ({
          question: item.question || item.text,
          options: item.options || [item.a, item.b, item.c, item.d].filter(Boolean),
          answer: item.answer || item.correctAnswer,
        }));
      } catch {
        // Plain text parsing
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const rows = [];
        let currentBlock = [];

        const flushBlock = () => {
          if (!currentBlock.length) return;
          const questionLine = currentBlock.find(l => /^\s*\d+[\.)]?\s*/.test(l));
          if (!questionLine) { currentBlock = []; return; }
          const questionText = questionLine.replace(/^\s*\d+[\.)]?\s*/, '').trim();
          const options = currentBlock
            .filter(l => l !== questionLine)
            .map(l => {
              const m = l.match(/^\s*[-*]?\s*([A-Da-d])[\.)\|:]\s*(.+)$/);
              if (m) return m[2].trim();
              const lm = l.match(/^\s*([A-Da-d])\s+(.+)$/);
              if (lm && l.length < 120) return lm[2].trim();
              return null;
            })
            .filter(Boolean);
          if (options.length >= 2) rows.push({ question: questionText, options });
          currentBlock = [];
        };

        for (const line of lines) {
          if (!line) continue;
          if (/^\s*answer/i.test(line) || /^\s*correct/i.test(line)) continue;
          if (/^\s*\d+[\.)]?\s*/.test(line) && currentBlock.length) flushBlock();
          currentBlock.push(line);
        }
        flushBlock();
        return rows;
      }
    };

    const buildQuestions = (qBuffer, aBuffer) => {
      const answerKey = parseAnswerKey(aBuffer);
      const rows = parseQuestionRows(qBuffer);
      console.log(`  Parsed ${rows.length} questions, ${answerKey.length} answers`);
      return rows.map((row, i) => {
        const options = row.options?.map(o => String(o).trim()).filter(Boolean) || [];
        const correctAnswer = normalizeAnswer(row.answer) ?? answerKey[i];
        return { question: row.question.trim(), options, correctAnswer };
      });
    };

    return { buildQuestions, parseQuestionRows, parseAnswerKey };
  })();

  // Test with sample text format
  const sampleQuestions = Buffer.from(`1. What is 2+2?
A. 3
B. 4
C. 5
D. 6

2. Capital of India?
A. Mumbai
B. Delhi
C. Chennai
D. Kolkata
`);

  const sampleAnswers = Buffer.from(`B
B
`);

  try {
    const questions = buildQuestions(sampleQuestions, sampleAnswers);
    console.log('  Parsed questions:');
    questions.forEach((q, i) => {
      console.log(`  ${i+1}. "${q.question}" -> Options: [${q.options.join(', ')}] Correct: ${q.correctAnswer}`);
    });
    console.log('✅ File parsing works!');
  } catch (err) {
    console.error('❌ File parsing failed:', err.message);
  }

  // Test with pipe-delimited format
  console.log('\n--- Testing pipe-delimited format ---');
  const pipeQuestions = Buffer.from(`1. What is 2+2? | 3 | 4 | 5 | 6
2. Capital of India? | Mumbai | Delhi | Chennai | Kolkata
`);

  try {
    const rows = parseQuestionRows(pipeQuestions);
    console.log(`  Parsed ${rows.length} rows`);
    rows.forEach((r, i) => console.log(`  ${i+1}. "${r.question}" -> [${r.options.join(', ')}]`));
  } catch (err) {
    console.error('❌ Pipe format parsing failed:', err.message);
  }

  await mongoose.disconnect();
  console.log('\nDone.');
};

run().catch(console.error);

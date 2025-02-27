const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDatabase() {
  try {
    // Create a test summary
    const testSummary = await prisma.summary.create({
      data: {
        content: "This is a test summary",
        inputType: "text",
        inputContent: "Original test content",
        aiMetrics: {
          create: {
            confidenceScore: 85,
            processingTime: 1.2,
            wordCount: 5
          }
        }
      },
      include: {
        aiMetrics: true
      }
    });

    console.log('Created test summary:', testSummary);

    // Read it back
    const savedSummary = await prisma.summary.findUnique({
      where: { id: testSummary.id },
      include: { aiMetrics: true }
    });

    console.log('Retrieved summary:', savedSummary);

  } catch (error) {
    console.error('Database test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase(); 
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testQuery() {
  // check-db.ts 결과를 보면 2개의 이민수 계정이 있음
  const userId1 = '75f7f032-ae95-48d6-8779-31518ed83bf4'; // mingyu@example.com
  const userId2 = '5ffc7298-98c5-44d0-a62e-7a2ac180a64d'; // test@mju.ac.kr (style_profile 있음)

  console.log('\n🔍 두 이민수 계정 비교:\n');

  for (const userId of [userId1, userId2]) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    console.log(`\n👤 ${user?.name} (${user?.email}):`);

    const profile = await prisma.styleProfile.findUnique({
      where: { user_id: userId },
    });

    if (profile) {
      console.log('  ✅ style_profile 있음');
      console.log(`  - custom_guidelines: ${profile.custom_guidelines ? '있음' : 'NULL'}`);
      if (profile.custom_guidelines) {
        console.log(`\n${profile.custom_guidelines.substring(0, 100)}...`);
      }
    } else {
      console.log('  ❌ style_profile 없음');
    }
  }

  const userId = userId2; // test@mju.ac.kr 사용

  console.log('\n🔍 현재 쿼리 방식 테스트:\n');

  // 방법 1: $queryRaw (현재 코드)
  const rows1 = await prisma.$queryRaw<
    Array<{ custom_guidelines: string | null }>
  >`
    SELECT custom_guidelines
    FROM style_profiles
    WHERE user_id = ${userId}::uuid
    LIMIT 1
  `;

  console.log('1. $queryRaw 결과:');
  console.log('  - rows:', rows1);
  console.log('  - rows.length:', rows1.length);
  console.log('  - rows[0]:', rows1[0]);
  console.log('  - custom_guidelines:', rows1[0]?.custom_guidelines);

  // 방법 2: findUnique (Prisma ORM)
  const profile = await prisma.styleProfile.findUnique({
    where: { user_id: userId },
    select: { custom_guidelines: true },
  });

  console.log('\n2. findUnique 결과:');
  console.log('  - profile:', profile);
  console.log('  - custom_guidelines:', profile?.custom_guidelines);

  // 방법 3: 현재 코드의 방식
  const result = await prisma.$queryRaw<
    Array<{ custom_guidelines: string | null }>
  >`
    SELECT custom_guidelines
    FROM style_profiles
    WHERE user_id = ${userId}::uuid
    LIMIT 1
  `.then((rows) => rows[0] || null);

  console.log('\n3. 현재 코드 방식:');
  console.log('  - result:', result);
  console.log('  - custom_guidelines:', result?.custom_guidelines);

  await prisma.$disconnect();
}

testQuery();

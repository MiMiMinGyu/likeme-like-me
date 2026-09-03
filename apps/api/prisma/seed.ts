import {
  PrismaClient,
  RelationshipCategory,
  PolitenessLevel,
  VibeType,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 기본 사용자 생성
  const testUser = await prisma.user.upsert({
    where: { username: 'testuser' },
    update: {},
    create: {
      username: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      password_hash: '$2b$10$dummyhashedpassword',
    },
  });
  console.log('✅ Test user created:', testUser.username);

  // 추가 사용자 (이민수)
  const mingyuUser = await prisma.user.upsert({
    where: { username: '미민수' },
    update: {},
    create: {
      id: '75f7f032-ae95-48d6-8779-31518ed83bf4',
      username: '미민수',
      name: '이민수',
      email: 'mingyu@example.com',
      password_hash: '$2b$10$dummyhashedpassword',
    },
  });
  console.log('✅ Mingyu user created:', mingyuUser.username);

  // 샘플 상대방(Partner) 생성 - findFirst로 찾고 없으면 create
  let partnerParent = await prisma.partner.findFirst({
    where: { name: '엄마' },
  });
  if (!partnerParent) {
    partnerParent = await prisma.partner.create({
      data: { name: '엄마' },
    });
  }
  console.log('✅ Partner created:', partnerParent.name);

  let partnerFriend = await prisma.partner.findFirst({
    where: { name: '친구' },
  });
  if (!partnerFriend) {
    partnerFriend = await prisma.partner.create({
      data: { name: '친구' },
    });
  }
  console.log('✅ Partner created:', partnerFriend.name);

  let partnerBoss = await prisma.partner.findFirst({
    where: { name: '팀장님' },
  });
  if (!partnerBoss) {
    partnerBoss = await prisma.partner.create({
      data: { name: '팀장님' },
    });
  }
  console.log('✅ Partner created:', partnerBoss.name);

  // 샘플 관계 설정
  await prisma.relationship.upsert({
    where: {
      user_id_partner_id: {
        user_id: testUser.id,
        partner_id: partnerParent.id,
      },
    },
    update: {},
    create: {
      user_id: testUser.id,
      partner_id: partnerParent.id,
      category: RelationshipCategory.FAMILY_ELDER_CLOSE,
      politeness: PolitenessLevel.POLITE,
      vibe: VibeType.CARING,
      emoji_level: 1,
    },
  });
  console.log('✅ Relationship created: testuser - 엄마');

  await prisma.relationship.upsert({
    where: {
      user_id_partner_id: {
        user_id: testUser.id,
        partner_id: partnerFriend.id,
      },
    },
    update: {},
    create: {
      user_id: testUser.id,
      partner_id: partnerFriend.id,
      category: RelationshipCategory.FRIEND_CLOSE,
      politeness: PolitenessLevel.CASUAL,
      vibe: VibeType.PLAYFUL,
      emoji_level: 2,
    },
  });
  console.log('✅ Relationship created: testuser - 친구');

  await prisma.relationship.upsert({
    where: {
      user_id_partner_id: {
        user_id: testUser.id,
        partner_id: partnerBoss.id,
      },
    },
    update: {},
    create: {
      user_id: testUser.id,
      partner_id: partnerBoss.id,
      category: RelationshipCategory.WORK_SENIOR_FORMAL,
      politeness: PolitenessLevel.FORMAL,
      vibe: VibeType.CALM,
      emoji_level: 0,
    },
  });
  console.log('✅ Relationship created: testuser - 팀장님');

  // 샘플 톤 샘플 추가 (임베딩은 애플리케이션에서 생성)
  const toneSamples = [
    {
      text: '오늘은 한식 어떠세요?',
      category: RelationshipCategory.FAMILY_ELDER_CLOSE,
      politeness: PolitenessLevel.POLITE,
      vibe: VibeType.CARING,
    },
    {
      text: '가볍게 칼국수도 좋아요.',
      category: RelationshipCategory.FAMILY_ELDER_CLOSE,
      politeness: PolitenessLevel.POLITE,
      vibe: VibeType.CARING,
    },
    {
      text: '이번 주말에 영화 볼래?',
      category: RelationshipCategory.FRIEND_CLOSE,
      politeness: PolitenessLevel.CASUAL,
      vibe: VibeType.PLAYFUL,
    },
    {
      text: '좋아! 토요일 오후 2시 어때?',
      category: RelationshipCategory.FRIEND_CLOSE,
      politeness: PolitenessLevel.CASUAL,
      vibe: VibeType.PLAYFUL,
    },
    {
      text: '보고서 작성이 완료되었습니다.',
      category: RelationshipCategory.WORK_SENIOR_FORMAL,
      politeness: PolitenessLevel.FORMAL,
      vibe: VibeType.CALM,
    },
    {
      text: '검토 부탁드립니다.',
      category: RelationshipCategory.WORK_SENIOR_FORMAL,
      politeness: PolitenessLevel.FORMAL,
      vibe: VibeType.CALM,
    },
  ];

  for (const sample of toneSamples) {
    await prisma.toneSample.create({
      data: {
        user_id: testUser.id,
        ...sample,
      },
    });
  }
  console.log('✅ Tone samples created: 6 samples');

  console.log('🎉 Database seed completed successfully!');
}

void (async () => {
  try {
    await main();
  } catch (e) {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();

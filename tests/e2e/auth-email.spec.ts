import { expect, test } from '@playwright/test'

test('가입 화면과 한국어 안내를 제공한다', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: '회원가입으로 전환' }).click()

  await expect(page.getByRole('heading', { name: '회원가입' })).toBeVisible()
  await expect(
    page.getByText('가입 확인 메일을 받은 뒤 로그인할 수 있습니다.'),
  ).toBeVisible()
})

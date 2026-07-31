import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const passwords = new PasswordService();

  it('hashes and verifies a known password with argon2', async () => {
    const password = 'RallyTestPass123!';
    const hash = await passwords.hash(password);

    expect(hash).not.toEqual(password);
    expect(hash.startsWith('$argon2')).toBe(true);
    await expect(passwords.verify(hash, password)).resolves.toBe(true);
    await expect(passwords.verify(hash, 'wrong-password')).resolves.toBe(false);
  });
});

export class User {
  id!: string;
  name!: string;
  email!: string;

  constructor(init?: Partial<User>) {
    Object.assign(this, init);
  }
}

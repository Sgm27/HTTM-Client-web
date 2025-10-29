export class DAO<TConnection = unknown> {
  constructor(protected readonly con: TConnection) {}
}

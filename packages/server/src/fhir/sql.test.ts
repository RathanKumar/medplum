import { Client } from 'pg';
import {
  Column,
  Condition,
  Negation,
  SelectPerReferenceQuery,
  SelectQuery,
  SqlBuilder,
  periodToRangeString,
} from './sql';

describe('SqlBuilder', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('Select', () => {
    const sql = new SqlBuilder();
    new SelectQuery('MyTable').column('id').column('name').buildSql(sql);
    expect(sql.toString()).toBe('SELECT "MyTable"."id", "MyTable"."name" FROM "MyTable"');
  });

  test('Select where', () => {
    const sql = new SqlBuilder();
    new SelectQuery('MyTable').column('id').where('name', '=', 'x').buildSql(sql);
    expect(sql.toString()).toBe('SELECT "MyTable"."id" FROM "MyTable" WHERE "MyTable"."name" = $1');
  });

  test('Select where expression', () => {
    const sql = new SqlBuilder();
    new SelectQuery('MyTable')
      .column('id')
      .whereExpr(new Condition('name', '=', 'x'))
      .buildSql(sql);
    expect(sql.toString()).toBe('SELECT "MyTable"."id" FROM "MyTable" WHERE "name" = $1');
  });

  test('Select where negation', () => {
    const sql = new SqlBuilder();
    new SelectQuery('MyTable')
      .column('id')
      .whereExpr(new Negation(new Condition('name', '=', 'x')))
      .buildSql(sql);
    expect(sql.toString()).toBe('SELECT "MyTable"."id" FROM "MyTable" WHERE NOT ("name" = $1)');
  });

  test('Select where array contains', () => {
    const sql = new SqlBuilder();
    new SelectQuery('MyTable').column('id').where('name', 'ARRAY_CONTAINS', 'x', 'TEXT[]').buildSql(sql);
    expect(sql.toString()).toBe(
      'SELECT "MyTable"."id" FROM "MyTable" WHERE ("MyTable"."name" IS NOT NULL AND "MyTable"."name" && ARRAY[$1]::TEXT[])'
    );
  });

  test('Select where array contains array', () => {
    const sql = new SqlBuilder();
    new SelectQuery('MyTable').column('id').where('name', 'ARRAY_CONTAINS', ['x', 'y'], 'TEXT[]').buildSql(sql);
    expect(sql.toString()).toBe(
      'SELECT "MyTable"."id" FROM "MyTable" WHERE ("MyTable"."name" IS NOT NULL AND "MyTable"."name" && ARRAY[$1,$2]::TEXT[])'
    );
  });

  test('Select where array contains missing param type', () => {
    const sql = new SqlBuilder();
    expect(() => new SelectQuery('MyTable').column('id').where('name', 'ARRAY_CONTAINS', 'x').buildSql(sql)).toThrow(
      'ARRAY_CONTAINS requires paramType'
    );
  });

  test('Select where is null', () => {
    const sql = new SqlBuilder();
    new SelectQuery('MyTable').column('id').where('name', '=', null).buildSql(sql);
    expect(sql.toString()).toBe('SELECT "MyTable"."id" FROM "MyTable" WHERE "MyTable"."name" IS NULL');
  });

  test('Select where is not null', () => {
    const sql = new SqlBuilder();
    new SelectQuery('MyTable').column('id').where('name', '!=', null).buildSql(sql);
    expect(sql.toString()).toBe('SELECT "MyTable"."id" FROM "MyTable" WHERE "MyTable"."name" IS NOT NULL');
  });

  test('Select value in subquery with type', () => {
    const sql = new SqlBuilder();
    new SelectQuery('MyTable')
      .column('id')
      .where('name', 'IN_SUBQUERY', new SelectQuery('MyLookup').column('values'), 'TEXT[]')
      .buildSql(sql);
    expect(sql.toString()).toBe(
      'SELECT "MyTable"."id" FROM "MyTable" WHERE "MyTable"."name"=ANY((SELECT "MyLookup"."values" FROM "MyLookup")::TEXT[])'
    );
  });

  test('Select value in subquery without type', () => {
    const sql = new SqlBuilder();
    new SelectQuery('MyTable')
      .column('id')
      .where('name', 'IN_SUBQUERY', new SelectQuery('MyLookup').column('values'))
      .buildSql(sql);
    expect(sql.toString()).toBe(
      'SELECT "MyTable"."id" FROM "MyTable" WHERE "MyTable"."name"=ANY(SELECT "MyLookup"."values" FROM "MyLookup")'
    );
  });

  test('Select group by', () => {
    const sql = new SqlBuilder();
    new SelectQuery('MyTable').column('id').groupBy('name').groupBy(new Column('MyTable', 'email')).buildSql(sql);
    expect(sql.toString()).toBe('SELECT "MyTable"."id" FROM "MyTable" GROUP BY "MyTable"."name", "MyTable"."email"');
  });

  test('Select distinct on', () => {
    const sql = new SqlBuilder();
    new SelectQuery('MyTable')
      .column('id')
      .column('name')
      .distinctOn('id')
      .distinctOn(new Column('MyTable', 'name'))
      .buildSql(sql);
    expect(sql.toString()).toBe(
      'SELECT DISTINCT ON ("MyTable"."id", "MyTable"."name") "MyTable"."id", "MyTable"."name" FROM "MyTable"'
    );
  });

  test('Select distinct on sorting', () => {
    const sql = new SqlBuilder();
    new SelectQuery('MyTable')
      .column('id')
      .column('name')
      .column('email')
      .distinctOn('id')
      .distinctOn(new Column('MyTable', 'name'))
      .orderBy('email')
      .buildSql(sql);
    expect(sql.toString()).toBe(
      'SELECT DISTINCT ON ("MyTable"."id", "MyTable"."name") "MyTable"."id", "MyTable"."name", "MyTable"."email" FROM "MyTable" ORDER BY "MyTable"."id", "MyTable"."name", "MyTable"."email"'
    );
  });

  test('Select where not equals', () => {
    const sql = new SqlBuilder();
    new SelectQuery('MyTable').column('id').where('name', '!=', 'x').buildSql(sql);
    expect(sql.toString()).toBe('SELECT "MyTable"."id" FROM "MyTable" WHERE "MyTable"."name" <> $1');
  });

  test('Select where like', () => {
    const sql = new SqlBuilder();
    new SelectQuery('MyTable').column('id').where('name', 'LIKE', 'x').buildSql(sql);
    expect(sql.toString()).toBe('SELECT "MyTable"."id" FROM "MyTable" WHERE LOWER("MyTable"."name") LIKE $1');
  });

  test('Select where not like', () => {
    const sql = new SqlBuilder();
    new SelectQuery('MyTable').column('id').where('name', 'NOT_LIKE', 'x').buildSql(sql);
    expect(sql.toString()).toBe('SELECT "MyTable"."id" FROM "MyTable" WHERE LOWER("MyTable"."name") NOT LIKE $1');
  });

  describe('Select per reference', () => {
    test('Basic', () => {
      const sql = new SqlBuilder();
      new SelectPerReferenceQuery('Observation', new Column('Observation', 'subject'), [
        'Patient/4c93dfd3-878f-4dbc-8c30-46d146105bc3',
        'Patient/afc5f9a2-529a-4ae4-a3f4-263de813a3a0',
        'Patient/fc6ac399-4e16-4454-897c-7dba5a04120b',
      ])
        .column('id')
        .column('content')
        .where('deleted', '=', false)
        .limit(3)
        .buildSql(sql);
      expect(sql.toString()).toBe(
        'SELECT "results"."id", "results"."content", "references"."reference" FROM (SELECT DISTINCT "subject" AS "reference" FROM "Observation" WHERE ("Observation"."subject" IN ($1,$2,$3) AND "Observation"."deleted" = $4)) AS "references" JOIN LATERAL (SELECT "ranked"."id", "ranked"."content" FROM (SELECT "Observation"."id", "Observation"."content", ROW_NUMBER() OVER () AS rn FROM "Observation" WHERE ("Observation"."subject" = "references"."reference" AND "Observation"."deleted" = $5)) AS "ranked" WHERE "ranked"."rn" <= $6) AS "results" ON true'
      );
    });

    test('with sort', () => {
      const sql = new SqlBuilder();
      new SelectPerReferenceQuery('Observation', new Column('Observation', 'subject'), [
        'Patient/4c93dfd3-878f-4dbc-8c30-46d146105bc3',
        'Patient/afc5f9a2-529a-4ae4-a3f4-263de813a3a0',
        'Patient/fc6ac399-4e16-4454-897c-7dba5a04120b',
      ])
        .column('id')
        .column('content')
        .where('deleted', '=', false)
        .orderBy('lastUpdated', true)
        .limit(3)
        .buildSql(sql);
      expect(sql.toString()).toBe(
        'SELECT "results"."id", "results"."content", "references"."reference" FROM (SELECT DISTINCT "subject" AS "reference" FROM "Observation" WHERE ("Observation"."subject" IN ($1,$2,$3) AND "Observation"."deleted" = $4)) AS "references" JOIN LATERAL (SELECT "ranked"."id", "ranked"."content" FROM (SELECT "Observation"."id", "Observation"."content", ROW_NUMBER() OVER ( ORDER BY "Observation"."lastUpdated" DESC) AS rn FROM "Observation" WHERE ("Observation"."subject" = "references"."reference" AND "Observation"."deleted" = $5)) AS "ranked" WHERE "ranked"."rn" <= $6) AS "results" ON true'
      );
    });
  });

  test('Select missing columns', () => {
    const sql = new SqlBuilder();
    expect(() => new SelectQuery('MyTable').buildSql(sql)).toThrow('No columns selected');
  });

  test('periodToRangeString', () => {
    expect(periodToRangeString({})).toBeUndefined();
    expect(periodToRangeString({ start: '2020-01-01' })).toBe('[2020-01-01,]');
    expect(periodToRangeString({ end: '2020-01-01' })).toBe('[,2020-01-01]');
    expect(periodToRangeString({ start: '2020-01-01', end: '2020-01-02' })).toBe('[2020-01-01,2020-01-02]');
  });

  test('Debug mode', async () => {
    console.log = jest.fn();

    const sql = new SqlBuilder();
    sql.debug = 'true';
    new SelectQuery('MyTable').column('id').buildSql(sql);
    expect(sql.toString()).toBe('SELECT "MyTable"."id" FROM "MyTable"');

    const conn = {
      query: jest.fn(() => ({ rows: [] })),
    } as unknown as Client;

    await sql.execute(conn);
    expect(console.log).toHaveBeenCalledWith('sql', 'SELECT "MyTable"."id" FROM "MyTable"');
  });
});

console.log("regular javascript file");

const doSomethingWithGraphQLString = (str) => {
  // Fetch Hasura/GraphQL API do your magic...
  return str;
};

const myQuery = doSomethingWithGraphQLString(/* GraphQL */ `
  mutation a {
    login(args: { username: "", password: "1235" }) {
      headerAccessToken
    }
  }
  query b {
    vouchers_by_pk(id: "uuid") {
      valid_until
    }
  }
  query z {
    vouchers {
      campaign
      code
    }
  }
  subscription s {
    device_events(
      distinct_on: payload
      limit: 5
      offset: 0
      order_by: { created_at: asc_nulls_first }
      where: { name: { _eq: "IoT" } }
    ) {
      name
      payload
      type
    }
  }
`);

console.log("regular javascript test file...");

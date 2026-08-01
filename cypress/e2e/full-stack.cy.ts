describe("Cypress full-stack harness", () => {
  it("registers through the UI and reads the persisted user through the real API", () => {
    cy.fixture("harness-user").then((user) => {
      cy.visit("/en/auth/register");

      cy.get("#firstName").type(user.firstName);
      cy.get("#lastName").type(user.lastName);
      cy.get("#email").type(user.email);
      cy.get("#username").type(user.username);
      cy.get("#password").type(user.password, { log: false });
      cy.get('button[type="submit"]').click();

      cy.location("pathname", { timeout: 20_000 }).should("equal", "/en");
      cy.getCookie("user_token").should("have.property", "httpOnly", true);

      cy.request({
        method: "GET",
        url: `${Cypress.expose("apiUrl")}/user/me`,
      }).then((response) => {
        expect(response.status).to.equal(200);
        expect(response.body).to.include({
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
        });
        expect(response.body.id).to.be.a("string").and.not.equal("");
        expect(response.body.createdAt).to.be.a("string").and.not.equal("");
        expect(response.body).not.to.have.any.keys(
          "password",
          "passwordHash",
        );
      });
    });
  });
});

const user = {
  firstName: "Cypress",
  lastName: "Magic",
  email: "cypress-magic-link-001@example.com",
  username: "cypress_magic_001",
  password: "CyMagic!123",
};

describe("magic-link authentication boundaries", () => {
  it("signs in through the real email-link flow and keeps the destination", () => {
    cy.visit("/en/auth/register");
    cy.get("#firstName").type(user.firstName);
    cy.get("#lastName").type(user.lastName);
    cy.get("#email").type(user.email);
    cy.get("#username").type(user.username);
    cy.get("#password").type(user.password, { log: false });
    cy.get('button[type="submit"]').should("be.enabled").click();
    cy.location("pathname", { timeout: 20_000 }).should("equal", "/en");

    cy.clearCookie("user_token");
    cy.visit("/en/auth/login?from=%2Fen%2Fprofile");
    cy.get("#email").type(user.email);
    cy.contains("button", "Email me a sign-in link").click();
    cy.get("[data-testid=dev-magic-link]").click();

    cy.location("pathname", { timeout: 20_000 }).should("equal", "/en/profile");
    cy.getCookie("user_token").should("have.property", "httpOnly", true);
    cy.contains(user.username).should("be.visible");
  });

  for (const boundary of [
    {
      locale: "en",
      title: "This link can’t be used",
      action: "Request a new link",
    },
    {
      locale: "th",
      title: "ไม่สามารถใช้ลิงก์นี้ได้",
      action: "ขอลิงก์ใหม่",
    },
  ]) {
    it(`renders the ${boundary.locale} invalid-link recovery boundary`, () => {
      cy.viewport(390, 844);
      cy.visit(`/${boundary.locale}/auth/verify`);
      cy.get("[data-testid=magic-verify-invalid]")
        .should("be.visible")
        .and("contain.text", boundary.title);
      cy.contains("a", boundary.action)
        .should("have.attr", "href", `/${boundary.locale}/auth/login`)
        .and("be.visible");
      cy.document().then((document) => {
        expect(document.documentElement.scrollWidth).to.be.at.most(390);
      });
    });
  }
});

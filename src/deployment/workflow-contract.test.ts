import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("integration preview deployment workflow", () => {
  it("keeps branch pushes verification-only and requires explicit preview dispatch", () => {
    const yaml = readFileSync(".github/workflows/deploy-preview.yml", "utf8");
    const nginx = readFileSync("deploy/nginx/evidence-vault-preview.conf.template", "utf8");

    expect(yaml).toContain("pull_request:");
    expect(yaml).toContain("push:");
    expect(yaml).toContain("develop");
    expect(yaml).toContain("workflow_dispatch:");
    expect(yaml).toContain("probe");
    expect(yaml).toContain("deploy");
    expect(yaml).toContain("ssh.gsmsv.site");
    expect(yaml).toContain("24136");
    expect(yaml).toContain("secrets.SSH_PASSWORD");
    expect(yaml).toContain("scripts/deploy-preview.sh");
    expect(yaml).toContain("appleboy/ssh-action@029f5b4aeeeb58fdfe1410a5d17f967dacf36262");
    expect(yaml).not.toContain("appleboy/ssh-action@v1.0.3");
    expect(yaml).not.toContain("pm2 delete all");
    expect(yaml).not.toContain("git push origin main");

    const serverProbeStart = yaml.indexOf("  server-probe:");
    const deployStart = yaml.indexOf("\n  deploy:");
    const serverProbe = yaml.slice(serverProbeStart, deployStart);
    const deploy = yaml.slice(deployStart);

    expect(serverProbe).toContain("github.event_name == 'workflow_dispatch'");
    expect(serverProbe).not.toContain("github.event_name == 'push'");
    expect(deploy).toContain("github.event_name == 'workflow_dispatch'");
    expect(deploy).toContain("inputs.mode == 'deploy'");
    expect(deploy).not.toContain("github.event_name == 'push'");

    expect(nginx).toContain("server_name evidence-vault.https.gsmsv.site;");
    expect(nginx).toContain("proxy_pass http://127.0.0.1:3011;");
    expect(nginx).not.toContain("ssl_certificate");
  });
});

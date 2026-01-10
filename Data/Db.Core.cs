using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

/// <summary>
/// Database access layer (Dapper) for the PocusSchedualer backend.
/// Split into partial files by domain (OTP, Activities, Lead Assignment, Email, etc.).
/// </summary>
public sealed partial class Db
{
    private readonly IConfiguration _cfg;

    /// <summary>
    /// Creates a new <see cref="Db"/> instance using the application's configuration.
    /// </summary>
    /// <param name="cfg">Configuration that contains connection strings and app settings.</param>
    public Db(IConfiguration cfg) => _cfg = cfg;

    /// <summary>
    /// Resolves the SQL connection string (tries multiple keys for backward compatibility).
    /// </summary>
    private string ConnString =>
        _cfg.GetConnectionString("PocusSchedualer")
        ?? _cfg.GetConnectionString("SimLoanDb")
        ?? _cfg.GetConnectionString("DefaultConnection")
        ?? throw new Exception("Missing connection string (PocusSchedualer / SimLoanDb / DefaultConnection)");

    /// <summary>
    /// Opens and returns a new SQL connection.
    /// </summary>
    private SqlConnection NewConnection()
    {
        var c = new SqlConnection(ConnString);
        c.Open();
        return c;
    }

    /// <summary>
    /// Opens and returns an <see cref="SqlConnection"/>. Caller should dispose it (await using).
    /// </summary>
    public SqlConnection Open() => NewConnection();

    /// <summary>
    /// Lightweight DB health check (used by /health/db).
    /// </summary>
    public async Task<bool> IsDbAliveAsync()
    {
        await using var c = Open();
        var x = await c.QuerySingleAsync<int>("SELECT 1;");
        return x == 1;
    }

    /// <summary>
    /// Returns the current database server time (GETDATE()).
    /// </summary>
    public async Task<DateTime> GetDbTimeAsync()
    {
        await using var c = NewConnection();
        return await c.QuerySingleAsync<DateTime>("SELECT GETDATE()");
    }
}
